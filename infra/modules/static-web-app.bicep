targetScope = 'resourceGroup'

@description('Globally unique Static Web App resource name.')
@minLength(1)
@maxLength(40)
param name string

@description('Azure region in which to create the Static Web App.')
param location string = resourceGroup().location

@description('Resource tags, including the Azure Developer CLI service tag.')
param tags object = {}

module staticWebApp 'br/public:avm/res/web/static-site:0.3.0' = {
  name: 'static-web-app'
  params: {
    name: name
    location: location
    sku: 'Free'
    stagingEnvironmentPolicy: 'Enabled'
    tags: tags
  }
}

output name string = staticWebApp.outputs.name
output resourceId string = staticWebApp.outputs.resourceId
output defaultHostname string = staticWebApp.outputs.defaultHostname
