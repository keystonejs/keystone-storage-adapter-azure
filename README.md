# Azure blob store-based storage adapter for KeystoneJS

This adapter is designed to replace the existing `AzureFile` field in KeystoneJS using the new storage API.

This adapter uses azure's blob store, not its file store. You will have to create a blob store account and container in the [azure portal](https://portal.azure.com/) before you can use this adapter to store things. See [azure documentation](https://azure.microsoft.com/en-us/documentation/articles/storage-create-storage-account/) for details on getting started with azure blob stores.

## Usage

Configure the storage adapter:

```javascript
var storage = new keystone.Storage({
  adapter: require('keystone-storage-adapter-azure'),
  azure: {
    accountName: 'myaccount', // optional - defaults to env.AZURE_STORAGE_ACCOUNT
    accountKey: 'XXYYZZ', // optional - defaults to env.AZURE_STORAGE_ACCESS_KEY
    container: 'mycontainer', // required
  },
  schema: {
    url: true, // optional - generate & store a public URL
    etag: true, // optional - store the etag for the resource
    container: true, // optional - store the referenced container in the database
  },
});
```

Then use it in your file type:

```javascript
File.add({
	name: { type: String },
	file: { type: Types.File, storage: storage, required: true, initial: true },
});
```


# License

Licensed under the standard MIT license. See [LICENSE](license).
