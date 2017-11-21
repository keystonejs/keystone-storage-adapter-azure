/*
TODO
- Check whether files exist before uploading (will always overwrite as-is)
- Support multiple retry attempts if a file exists (see FS Adapter)
*/

// Mirroring keystone 0.4's support of node 0.12.
var url = require('url');
var merge = require('lodash/merge');
var azure = require('azure-storage');
var azureCdnManagementClient = require('azure-arm-cdn');
var msRestAzure = require('ms-rest-azure');
var ensureCallback = require('keystone-storage-namefunctions/ensureCallback');
var nameFunctions = require('keystone-storage-namefunctions');

var debug = require('debug')('keystone-azure');

var DEFAULT_OPTIONS = {
	cacheControl: process.env.AZURE_STORAGE_CACHE_CONTROL,
	container: process.env.AZURE_STORAGE_CONTAINER,
	generateFilename: nameFunctions.randomFilename,
	cdn: {
		customDomain: process.env.AZURE_CDN_CUSTOM_DOMAIN,
		purge: process.env.AZURE_CDN_PURGE,
		credentials: {
			clientId: process.env.AZURE_CDN_CLIENT_ID,
			tenantId: process.env.AZURE_CDN_TENANT_ID,
			clientSecret: process.env.AZURE_CDN_CLIENT_SECRET,
		},
		profile: {
			subscriptionId: process.env.AZURE_CDN_SUBSCRIPTION_ID,
			endpointName: process.env.AZURE_CDN_ENDPOINT_NAME,
			profileName: process.env.AZURE_CDN_PROFILE_NAME,
			resourceGroupName: process.env.AZURE_CDN_RESOURCE_GROUP_NAME,
		},
	},
};

// azure-storage will automatically use either the environment variables
// AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY if they're provided, or
// AZURE_STORAGE_CONNECTION_STRING. We'll let the user override that configuration
// by specifying `azure.accountName and accountKey` or `connectionString`.

// azure-storage supports defining the cacheControl header of the uploaded blob.
// You can set this via the AZURE_STORAGE_CACHE_CONTROL env var or azure.cacheControl.
// Note, in most cases you'll want to set a sane cache control header - expecially
// when using an Azure CDN.

// azure-storage supports Azure CDN's in the following way;
// 1. AZURE_CDN_CUSTOM_DOMAIN will replace the blob's public URL
//    host with the one provided here and;
// 2. AZURE_CDN_PURGE will ensure we purge the CDN upon file
//    upload or deletion.
// Note: In order to support CDN purging you must provide a service principle (not interactive
// login) and properties of the CDN which can be defined as follows;
// AZURE_CDN_CLIENT_ID - Found as Application ID under properties of your App Registration
// AZURE_CDN_TENANT_ID - Found as Directory ID under Properties of Azure Active Directory
// AZURE_CDN_CLIENT_SECRET - A key you create for your App Registration
// AZURE_CDN_SUBSCRIPTION_ID - Found as Subscription ID for your CDN Profile
// AZURE_CDN_RESOURCE_GROUP_NAME - Found as Resource Group under properties of CDN Profile
// AZURE_CDN_PROFILE_NAME - Found in Azure blade title under CDN Profile
// AZURE_CDN_ENDPOINT_NAME - Found in Azure blade title under Endpoint
// See default options above for object definition to override.

// The container configuration is interesting because we could programatically
// create the container if it doesn't already exist. But if we did so, what
// permissions should it have? If you specify permissions, what should we do
// if a container with that name already exists with *different* access
// permissions? No, for now you must create the storage container yourself
// through the azure console.

// This constructor is usually called indirectly by the Storage class in
// keystone.

// Azure-specific options should be specified in an `options.azure` field.

// The schema can contain the additional fields { container, etag }.

// See README.md for details and usage examples.

function AzureAdapter (options, schema) {
	this.options = merge({}, DEFAULT_OPTIONS, options.azure);
	debug('AzureAdapter options', this.options);

	// Setup the blob service. This is used for uploading, downloading and deletion.
	if (this.options.accountName || this.options.connectionString) {
		this.blobSvc = azure.createBlobService(
			this.options.accountName || this.options.connectionString,
			this.options.accountKey,
			this.options.host
		);
	} else {
		// If no connection configuration is supplied, azure will pull it from
		// environment variables.
		this.blobSvc = azure.createBlobService();
	}

	// Setup the CDN service. This is used for purging, so we only initiate it if the user
	// has turned on purging. Start with some sanity checks.
	if (this.options.cdn.purge === true && !this.options.cdn.credentials.clientId
			|| this.options.cdn.purge === true && !this.options.cdn.credentials.tenantId
			|| this.options.cdn.purge === true && !this.options.cdn.credentials.clientSecret
			|| this.options.cdn.purge === true && !this.options.cdn.profile.subscriptionId
			|| this.options.cdn.purge === true && !this.options.cdn.profile.endpointName
			|| this.options.cdn.purge === true && !this.options.cdn.profile.profileName
			|| this.options.cdn.purge === true && !this.options.cdn.profile.resourceGroupName) {
		throw Error('Azure CDN configuration error: missing credentials (clientId, tentantId, clientSecret, subscriptionId, endpointName, profileName or resourceGroupName');
	}

	if (this.options.cdn.purge === true) {
		this.cdnCreds = new msRestAzure.ApplicationTokenCredentials(
			this.options.cdn.credentials.clientId,
			this.options.cdn.credentials.tenantId,
			this.options.cdn.credentials.clientSecret);
		this.cdnSvc = new azureCdnManagementClient(this.cdnCreds, this.options.cdn.profile.subscriptionId);
	}

	// Verify that the container setting exists.
	if (!this.options.container) {
		throw Error('Azure storage configuration error: missing container setting');
	}
	this.container = this.options.container;

	// Ensure the generateFilename option takes a callback
	this.options.generateFilename = ensureCallback(this.options.generateFilename);

	// Purge an Azure CDN
	this.purgeCdn = (container, file) => {
		debug('attempting to purge with path', `/${container}/${file}`);
		this.cdnSvc.endpoints.purgeContent(
			this.options.cdn.profile.resourceGroupName,
			this.options.cdn.profile.profileName,
			this.options.cdn.profile.endpointName, [`/${container}/${file}`], (error, result, request, response) => {
				if (error) {
					debug('CDN purge failed', error);
				}
			});
	};

	return this;
}

AzureAdapter.compatibilityLevel = 1;

// All the extra schema fields supported by this adapter.
AzureAdapter.SCHEMA_TYPES = {
	filename: String,
	container: String,
	etag: String,
};

AzureAdapter.SCHEMA_FIELD_DEFAULTS = {
	filename: true,
	container: false,
	etag: false,
};

AzureAdapter.prototype.uploadFile = function (file, callback) {
	var self = this;
	this.options.generateFilename(file, 0, function (err, blobName) {
		if (err) return callback(err);

		debug('Uploading file %s', blobName);
		var container = self.container;
		var uploadOpts = {
			contentType: file.mimetype,
		};

		if (self.options.cacheControl) {
			uploadOpts.cacheControl = self.options.cacheControl;
		}

		self.blobSvc.createBlockBlobFromLocalFile(
			container,
			blobName,
			file.path, // original name
			uploadOpts,
			function (err, result) {
				if (err) return callback(err);

				// We'll annotate the file with a bunch of extra properties. These won't
				// be saved in the database unless the corresponding schema options are
				// set.
				file.filename = blobName;
				file.etag = result.etag; // This is double-quoted just like the S3 equivalent

				// file.url is automatically populated by keystone's Storage class.

				// Storing this will force you to do a data migration if you rename the
				// azure storage container.
				file.container = container;

				// Purge if required
				if (self.options.cdn.purge === true) {
					self.purgeCdn(container, blobName);
				}

				debug('file upload successful');
				callback(null, file);
			});
	});
};

// Note that this will provide a public URL for the file, but it will only
// work if the container is public or you have set ACLs appropriately.
// We could generate a temporary file URL as well using an access token -
// file an issue if thats an important use case for you.
// Note that if you're using a CDN, some of these credential issues won't be an problem.
AzureAdapter.prototype.getFileURL = function (file) {
	// From https://msdn.microsoft.com/en-us/library/dd179440.aspx
	var fileUrl = url.parse(this.blobSvc.getUrl(this.container, file.filename));
	if (this.options.cdn.customDomain) {
		fileUrl = url.parse(this.options.cdn.customDomain + fileUrl.path);
	}
	debug('getting file url', fileUrl.href);
	return fileUrl.href;
};

AzureAdapter.prototype.removeFile = function (file, callback) {
	var self = this;
	var container = file.container || this.options.container;

	this.blobSvc.deleteBlob(container, file.filename, (error) => {
		if (error) {
			callback(error);
		}
		if (self.options.cdn.purge === true) {
			self.purgeCdn(container, file.filename);
		}
		callback(null, file);
	});
};

// Check if a file with the specified filename already exists. Callback called
// with the file headers if the file exists, null otherwise.
AzureAdapter.prototype.fileExists = function (filename, callback) {
	this.blobSvc.getBlobProperties(this.options.container, filename, function (err, res) {
		if (err && err.code === 'NotFound') return callback();
		if (err) return callback(err);
		callback(null, res);
	});

};

module.exports = AzureAdapter;
