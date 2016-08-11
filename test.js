/* eslint-env node, mocha */

// NOTE: Requires keystone4 to be linked with npm. Once keystone@0.4 is released
// we can set that as a devDependency.

// Pull in azure credentials from .env. Your .env file should look like this:
/*
AZURE_STORAGE_ACCOUNT=XXXX
AZURE_STORAGE_ACCESS_KEY=XXXX
AZURE_STORAGE_CONTAINER=XXXX
*/
// The adapter also will not create the storage container for you, so you'll
// need to do that before running the test. It should have publically readable
// blobs.

require('dotenv').config();

const fs = require('fs');
const assert = require('assert');

const AzureAdapter = require('./index');

describe('azure file field', function () {
	beforeEach(function () {
		// this.timeout(10000);
	});

	require('keystone/test/fileadapter')(AzureAdapter, {
		azure: { /* use environment variables */ },
	}, {
		filename: true,
		size: true,
		mimetype: true,
		path: true,
		originalname: true,
		url: true,

		// Extras for azure
		schema: true,
		etag: true,
	})();

	it('304s when you request the file using the returned etag');
	it('the returned etag doesnt contain enclosing quotes');

	describe('fileExists', () => {
		// This is stolen from keystone-s3. TODO: The code should be shared somewhere.
		it('returns an options object if you ask about a file that does exist', function (done) {
			// Piggybacking off the file that gets created as part of the keystone tests.
			// This should probably just be exposed as a helper method.
			var adapter = this.adapter;
			adapter.uploadFile({
				name: 'abcde.txt',
				mimetype: 'text/plain',
				originalname: 'originalname.txt',
				path: this.pathname,
				size: fs.statSync(this.pathname).size,
			}, function (err, file) {
				if (err) throw err;

				adapter.fileExists(file.filename, function (err, result) {
					if (err) throw err;
					assert.ok(result);

					adapter.removeFile(file, done);
				});
			});

		});

		it('returns falsy when you ask if fileExists for a nonexistant file', function (done) {
			this.adapter.fileExists('filethatdoesnotexist.txt', function (err, result) {
				if (err) throw err;
				assert(!result);
				done();
			});
		});
	});
});
