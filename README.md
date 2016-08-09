# Azure blob store-based storage adapter for KeystoneJS

This adapter is designed to replace the existing `AzureFile` field in KeystoneJS using the new storage API.

This adapter uses azure's blob store, not its file store. You will have to create a blob store account and container in the [azure portal](https://portal.azure.com/) before you can use this adapter to store things. See [azure documentation](https://azure.microsoft.com/en-us/documentation/articles/storage-create-storage-account/) for details on getting started with azure blob stores.

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

### Options:

The adapter requires an additional `azure` field added to the storage options. It accepts the following values:

- **accountName**: *(required)* Azure access key. Defaults to `process.env.AZURE_STORAGE_ACCOUNT`

- **accountKey**: *(required)* Azure access key. Defaults to `process.env.AZURE_STORAGE_ACCESS_KEY`

- **container**: *(required)* Azure blob store container to store files in. Defaults to `process.env.AZURE_STORAGE_CONTAINER`


### Schema

The S3 adapter supports all the standard Keystone file schema fields. It also supports storing the following values per-file:

- **container**: The blob store container for the file can be stored in the database. If this is present when reading or deleting files, it will be used instead of looking at the adapter configuration. The effect of this is that you can have some (eg, old) files in your collection stored in different container.

The main use of this is to allow slow data migrations. If you *don't* store these values you can arguably migrate your data more easily - just move it all, then reconfigure and restart your server.

- **etag**: The etag of the stored item. This is equal to the MD5 sum of the file content.


# License

Licensed under the standard MIT license. See [LICENSE](license).
