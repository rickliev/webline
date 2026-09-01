targetScope = 'subscription'

@minLength(1)
@maxLength(24)
param environmentName string

@allowed([
  'eastus2'
])
param location string

var resourceGroupName = 'rg-${environmentName}-${location}'
var commonTags = {
  application: 'webline'
  environment: 'production'
  'azd-env-name': environmentName
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module staticWebApp './modules/static-web-app.bicep' = {
  name: 'webline-static-web-app'
  scope: resourceGroup
  params: {
    name: 'stapp-webline-${take(uniqueString(subscription().id, resourceGroup.id), 8)}'
    location: location
    tags: union(commonTags, {
      'azd-service-name': 'web'
    })
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output WEB_URL string = 'https://${staticWebApp.outputs.defaultHostname}'
output WEB_RESOURCE_NAME string = staticWebApp.outputs.name
