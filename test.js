/* eslint-env node, mocha */

/**
	* FILE ADAPTER UNIT TESTS
	*/

// Testing
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const proxyquire = require('proxyquire');
const _ = require('lodash');

// Proxy stubs
let azureBlobServiceStub = {
	createBlockBlobFromLocalFile: (container, blob, name, opts, callback) => {
		return callback(null, { etag: 'etag' });
	},
	deleteBlob: (container, filename, callback) => {
		return callback(null);
	},
	getUrl: (container, filename) => {
		return `http://testhost.com/${container}/${filename}`;
	},
	getBlobProperties: (container, filename, callback) => {
		return callback(null, true);
	},
};

let azureStorageStub = {
	createBlobService: function () {
		return azureBlobServiceStub;
	},
};

let azureArmCdnStub = function () {
	return {
		endpoints: {
			purgeContent: purgeContentSpy,
		},
	};
};

let msRestAzureStub = {
	ApplicationTokenCredentials: function () {
		return;
	},
};

// Spies
const purgeContentSpy = sinon.spy();
const uploadFileSpy = sinon.spy(azureBlobServiceStub, 'createBlockBlobFromLocalFile');
const removeFileSpy = sinon.spy(azureBlobServiceStub, 'deleteBlob');
const blobPropertiesSpy = sinon.spy(azureBlobServiceStub, 'getBlobProperties');

describe('azure file field', function () {

	let originalProcessEnv;
	let AzureAdapter;
	let environmentStub;
	let environmentStubNoCdn;

	environmentStub = {
		AZURE_STORAGE_ACCOUNT: 'storage account',
		AZURE_STORAGE_ACCESS_KEY: 'access key',
		AZURE_STORAGE_CONTAINER: 'container',
		AZURE_STORAGE_CACHE_CONTROL: 'cache control',
		AZURE_CDN_PURGE: true,
		AZURE_CDN_CUSTOM_DOMAIN: 'http://custom.domain.com',
		AZURE_CDN_CLIENT_ID: 'client id',
		AZURE_CDN_TENANT_ID: 'tenant id',
		AZURE_CDN_CLIENT_SECRET: 'client secret',
		AZURE_CDN_SUBSCRIPTION_ID: 'subscription id',
		AZURE_CDN_ENDPOINT_NAME: 'endpoint name',
		AZURE_CDN_PROFILE_NAME: 'profile name',
		AZURE_CDN_RESOURCE_GROUP_NAME: 'group name',
	};

	environmentStubNoCdn = {
		AZURE_STORAGE_ACCOUNT: 'storage account',
		AZURE_STORAGE_ACCESS_KEY: 'access key',
		AZURE_STORAGE_CONTAINER: 'container',
		AZURE_STORAGE_CACHE_CONTROL: 'cache control',
		AZURE_CDN_PURGE: false,
	};

	beforeEach(function () {
		originalProcessEnv = _.cloneDeep(process.env);
	});

	afterEach(function () {
		process.env = _.cloneDeep(originalProcessEnv);
		purgeContentSpy.reset();
		uploadFileSpy.reset();
		removeFileSpy.reset();
		blobPropertiesSpy.reset();
	});

	describe('options', () => {

		it('should default properly given a correctly configured environment', () => {

			// Stub the environment
			process.env = environmentStub;

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'ms-rest-azure': msRestAzureStub,
				'azure-arm-cdn': azureArmCdnStub,
			});

			// This should load our environment settings and produce a usable options object.
			const adapter = AzureAdapter({}, {});

			expect(adapter.options.cacheControl).to.equal('cache control');
			expect(adapter.options.container).to.equal('container');
			expect(adapter.options.generateFilename).to.be.a('Function');

			expect(adapter.options.cdn).to.deep.equal({
				customDomain: 'http://custom.domain.com',
				purge: true,
				credentials: {
					clientId: 'client id',
					tenantId: 'tenant id',
					clientSecret: 'client secret',
				},
				profile: {
					subscriptionId: 'subscription id',
					endpointName: 'endpoint name',
					profileName: 'profile name',
					resourceGroupName: 'group name',
				},
			});

		});

		it('should override environment given options', () => {

			// Stub the environment
			process.env = environmentStub;

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			const options = {
				azure: {
					cacheControl: 'no-cache',
					container: 'container',
					generateFilename: 'test',
					cdn: {
						customDomain: 'http://test.com',
						purge: false,
						credentials: {
							clientId: 'client',
							tenantId: 'tenant',
							clientSecret: 'secret',
						},
						profile: {
							subscriptionId: 'sub',
							endpointName: 'endpoint',
							profileName: 'profile',
							resourceGroupName: 'group',
						},
					},
				},
			};

			// This should load the options above and produce a usable options object.
			const adapter = new AzureAdapter(options, {});

			expect(adapter.options).to.deep.equal(options.azure);

		});

		it('should load given options with no environment', () => {

			// Stub the environment
			process.env = {};

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			const options = {
				azure: {
					cacheControl: 'no-cache',
					container: 'container',
					generateFilename: 'test',
					cdn: {
						customDomain: 'http://test.com',
						purge: false,
						credentials: {
							clientId: 'client',
							tenantId: 'tenant',
							clientSecret: 'secret',
						},
						profile: {
							subscriptionId: 'sub',
							endpointName: 'endpoint',
							profileName: 'profile',
							resourceGroupName: 'group',
						},
					},
				},
			};

			// This should load the options above and produce a usable options object.
			const adapter = new AzureAdapter(options, {});

			expect(adapter.options).to.deep.equal(options.azure);

		});

		it('should not throw an error if purge is false with no creds or profile options set', () => {

			// Stub the environment
			process.env = {
				AZURE_STORAGE_ACCOUNT: 'storage account',
				AZURE_STORAGE_ACCESS_KEY: 'access key',
				AZURE_STORAGE_CONTAINER: 'container',
				AZURE_STORAGE_CACHE_CONTROL: 'cache control',
				AZURE_CDN_PURGE: false,
			};

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			expect(adapter.options.cdn.purge).to.equal(false);

		});

		it('should throw an error if purge is true with no creds or profile options set', () => {

			// Stub the environment
			process.env = {
				AZURE_STORAGE_ACCOUNT: 'storage account',
				AZURE_STORAGE_ACCESS_KEY: 'access key',
				AZURE_STORAGE_CONTAINER: 'container',
				AZURE_STORAGE_CACHE_CONTROL: 'cache control',
				AZURE_CDN_PURGE: true,
			};

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			// Should throw an error.
			expect(() => {
				const test = new AzureAdapter({}, {});
			}).to.throw('Azure CDN configuration error: missing credentials (clientId, tentantId, clientSecret, subscriptionId, endpointName, profileName or resourceGroupName');

		});

		it('should throw an error if no container is set', () => {

			// Stub the environment
			process.env = {
				AZURE_STORAGE_ACCOUNT: 'storage account',
				AZURE_STORAGE_ACCESS_KEY: 'access key',
				AZURE_STORAGE_CACHE_CONTROL: 'cache control',
				AZURE_CDN_PURGE: false,
			};

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			// Should throw an error.
			expect(() => {
				const test = new AzureAdapter({}, {});
			}).to.throw('Azure storage configuration error: missing container setting');

		});

		it('should support base schemas', () => {

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'azure-arm-cdn': azureArmCdnStub,
				'ms-rest-azure': msRestAzureStub,
			});

			// Should have sane schema
			expect(AzureAdapter.SCHEMA_TYPES).to.deep.equal({
				filename: String,
				container: String,
				etag: String,
			});

			expect(AzureAdapter.SCHEMA_FIELD_DEFAULTS).to.deep.equal({
				filename: true,
				container: false,
				etag: false,
			});

		});

	});

	describe('prototypes with cdn enabled', () => {

		beforeEach(function () {

			// Stub the environment
			process.env = environmentStub;

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'ms-rest-azure': msRestAzureStub,
				'azure-arm-cdn': azureArmCdnStub,
			});

		});

		it('should invoke azure clients purgeContent method with correct properties', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			// Run the purge method.
			adapter.purgeCdn('container', 'filename');

			// Ensure its called correctly.
			expect(purgeContentSpy.calledOnce).to.equal(true);
			expect(purgeContentSpy.calledWith('group name', 'profile name', 'endpoint name', ['/container/filename'])).to.equal(true);

		});

		it('should be able to upload a file to azure, with cachecontrol and purge an azure cdn', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({
				azure: {
					generateFilename: (file, i, callback) => {
						return callback(null, 'filename');
					},
				},
			}, {});

			// Spy on our purgeCdn method.
			adapter.purgeCdn = sinon.spy();

			// Mock a keystone file
			const file = {
				path: 'original filename',
				mimetype: 'mimetype',
			};

			// Test the method.
			adapter.uploadFile(file, (err, result) => {

				// Should return with an expected result
				expect(result).to.deep.equal({
					mimetype: 'mimetype',
					filename: 'filename',
					etag: 'etag',
					container: 'container',
					path: 'original filename',
				});

				// Should have run the azure upload with correct params
				expect(uploadFileSpy.calledWith('container', 'filename', 'original filename', { contentType: 'mimetype', cacheControl: 'cache control' })).to.equal(true);

				// Should have run the purge.
				expect(adapter.purgeCdn.calledWith('container', 'filename')).to.equal(true);

			});

		});

		it('should be able to load a file url from azure with a defined custom domain', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			// Mock a keystone file
			const file = {
				filename: 'filename.txt',
			};

			// Test the method.
			const url = adapter.getFileURL(file);

			expect(url).to.equal('http://custom.domain.com/container/filename.txt');

		});

		it('should be able to delete a file in azure and purge an azure cdn', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			// Spy on our purgeCdn method.
			adapter.purgeCdn = sinon.spy();

			// Mock a keystone file
			const file = {
				filename: 'filename',
				path: 'original filename',
				mimetype: 'mimetype',
			};

			// Test the method.
			adapter.removeFile(file, (err, result) => {

				// Should return with an expected result
				expect(result).to.deep.equal({
					filename: 'filename',
					path: 'original filename',
					mimetype: 'mimetype',
				});

				// Should have run the azure remove with correct params
				expect(removeFileSpy.calledWith('container', 'filename')).to.equal(true);
				
				// Should have run the purge.
				expect(adapter.purgeCdn.calledWith('container', 'filename')).to.equal(true);

			});

		});

		it('should be able to tell if a file exists in azure', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			// Test the method.
			adapter.fileExists('filename', (err, result) => {

				// Should return with an expected result
				expect(result).to.equal(true);

				// Should have run the azure remove with correct params
				expect(blobPropertiesSpy.calledWith('container', 'filename')).to.equal(true);

			});
		});

	});

	describe('prototypes with cdn disabled', () => {

		beforeEach(function () {

			// Stub the environment
			process.env = environmentStubNoCdn;

			// The adapter to test.
			AzureAdapter = proxyquire('./index', {
				'azure-storage': azureStorageStub,
				'ms-rest-azure': msRestAzureStub,
				'azure-arm-cdn': azureArmCdnStub,
			});

		});

		it('should be able to upload a file to azure and not purge', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({
				azure: {
					generateFilename: (file, i, callback) => {
						return callback(null, 'filename');
					},
				},
			}, {});

			// Spy on our purgeCdn method.
			adapter.purgeCdn = sinon.spy();

			// Mock a keystone file
			const file = {
				path: 'original filename',
				mimetype: 'mimetype',
			};

			// Test the method.
			adapter.uploadFile(file, (err, result) => {

				// Should not have run the purge.
				expect(adapter.purgeCdn.called).to.equal(false);

			});

		});

		it('should be able to delete a file in azure and not purge', () => {

			// This should load our environment settings and produce a usable options object.
			const adapter = new AzureAdapter({}, {});

			// Spy on our purgeCdn method.
			adapter.purgeCdn = sinon.spy();

			// Mock a keystone file
			const file = {
				filename: 'filename',
				path: 'original filename',
				mimetype: 'mimetype',
			};

			// Test the method.
			adapter.removeFile(file, (err, result) => {

				// Should not have run the purge.
				expect(adapter.purgeCdn.called).to.equal(false);

			});

		});

	});

});
