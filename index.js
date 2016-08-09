// Mirroring keystone 0.4's support of node 0.12.
var assign = require('object-assign');
var azure = require('azure-storage');
var debug = require('debug')('keystone-azure');

var DEFAULT_OPTIONS = {
	container: process.env.AZURE_STORAGE_CONTAINER,
};

// azure-storage will automatically use either the environment variables
// AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY if they're provided, or
// AZURE_STORAGE_CONNECTION_STRING. We'll let the user override that configuration
// by specifying `azure.accountName and accountKey` or `connectionString`.

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
	this.options = assign({}, DEFAULT_OPTIONS, options.azure);

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

	// Verify that the container setting exists.
	if (!this.options.container) {
		throw Error('Azure storage configuration error: missing container setting');
	}
	this.container = this.options.container;
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
	// TODO: Chat to Jed to decide how to share the generateFilename code from the
	// keystone Storage class.
	this.options.generateFilename(file, 0, function (err, blobName) {
		if (err) return callback(err);

		debug('Uploading file %s', blobName);
		var container = self.container;
		self.blobSvc.createBlockBlobFromLocalFile(
			container,
			blobName,
			file.path, // original name
			{ contentType: file.mimetype },
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

				debug('file upload successful');
				callback(null, file);
			});
	});
};

// Note that this will provide a public URL for the file, but it will only
// work if the container is public or you have set ACLs appropriately.
// We could generate a temporary file URL as well using an access token -
// file an issue if thats an important use case for you.
AzureAdapter.prototype.getFileURL = function (file) {
	// From https://msdn.microsoft.com/en-us/library/dd179440.aspx
	return this.blobSvc.getUrl(this.container, file.filename);
};

AzureAdapter.prototype.removeFile = function (file, callback) {
	this.blobSvc.deleteBlob(
		file.container || this.azureOptions.container, file.filename, callback
	);
};

module.exports = AzureAdapter;
