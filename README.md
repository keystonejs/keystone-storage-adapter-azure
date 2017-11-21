# Azure blob store-based storage adapter for KeystoneJS

This adapter is designed to replace the existing `AzureFile` field in KeystoneJS using the new storage API.

This adapter uses azure's blob store, not its file store. You will have to create a blob store account and container in the [azure portal](https://portal.azure.com/) before you can use this adapter to store things. See [azure documentation](https://azure.microsoft.com/en-us/documentation/articles/storage-create-storage-account/) for details on getting started with azure blob stores.

This adapter also supports CDN's by way of setting a custom domain and allowing automated purges upon
uploading or removing a file from the blob.

Compatible with Node.js 0.12+

## Usage

Configure the storage adapter:

```js
var storage = new keystone.Storage({
	adapter: require('keystone-storage-adapter-azure'),
	azure: {
		accountName: 'myaccount', // required; defaults to env.AZURE_STORAGE_ACCOUNT
		accountKey: 'secret', // required; defaults to env.AZURE_STORAGE_ACCESS_KEY
		container: 'mycontainer', // required; defaults to env.AZURE_STORAGE_CONTAINER
		generateFilename: keystone.Storage.randomFilename, // default
		cacheControl: '', // optional; defaults to env.AZURE_STORAGE_CACHE_CONTROL
		cdn: { // optional;
			customDomain: '', // optional; env.AZURE_CDN_CUSTOM_DOMAIN,
			purge: false, // optional; defaults to env.AZURE_CDN_PURGE,
			credentials: { // required upon setting purge to true;
				clientId: '', // defaults to env.AZURE_CDN_CLIENT_ID,
				tenantId: '', // defaults to env.AZURE_CDN_TENANT_ID,
				clientSecret: '', // defaults to env.AZURE_CDN_CLIENT_SECRET,
			},
			profile: { // required upon setting purge to true;
				subscriptionId: '', // defaults to env.AZURE_CDN_SUBSCRIPTION_ID,
				endpointName: '', // defaults to env.AZURE_CDN_ENDPOINT_NAME,
				profileName: '', // defaults to env.AZURE_CDN_PROFILE_NAME,
				resourceGroupName: '', // defaults to env.AZURE_CDN_RESOURCE_GROUP_NAME,
			},
		},
	},
	schema: {
		container: true, // optional; store the referenced container in the database
		etag: true, // optional; store the etag for the resource
		url: true, // optional; generate & store a public URL
	},
});
```

Then use it as the storage provider for a File field:

```js
MyList.add({
	name: { type: String },
	file: { type: Types.File, storage: storage },
});
```

### Schema

The Azure adapter supports all the standard Keystone file schema fields. It also supports storing the following values per-file:

- **container**: The blob store container for the file can be stored in the database. If this is present when reading or deleting files, it will be used instead of looking at the adapter configuration. The effect of this is that you can have some (eg, old) files in your collection stored in different container.

The main use of this is to allow slow data migrations. If you *don't* store these values you can arguably migrate your data more easily - just move it all, then reconfigure and restart your server.

- **etag**: The etag of the stored item. This is equal to the MD5 sum of the file content.


### Known issues

- The adapter always overwrites files regardless of overwrite options.
- The mimetype does not get set correctly when uploading files.

# License

Licensed under the standard MIT license. See [LICENSE](license).
