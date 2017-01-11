import { Reaction } from "/server/api";
import { Packages } from "/lib/collections";
import { Products } from "/lib/collections";
import Future from 'fibers/future';
import { MagentoImportStatus } from "../lib/collections/schemas";
import MagentoJS from "magentojs"

function updateStatus(value) {
  MagentoImportStatus.update({shopId: Reaction.getShopId()}, {$set: value});
}

function getMagentoConfig(settings) {
  if (!settings) {
    var magento = Packages.findOne({
      name: "magento-import",
      shopId: Reaction.getShopId()
    });
    var config = {
      host: magento.settings.host,
      port: magento.settings.port,
      path: magento.settings.path,
      login: magento.settings.user,
      pass: magento.settings.password,
      storeId: magento.settings.store,
      isSecure: true
    };
  } else {
    var config = {
      host: settings.host,
      port: settings.port,
      path: settings.path,
      login:settings.user,
      pass: settings.password,
      isSecure: true
    };
  }
  return config;

  /*var client = MagentoJS(config);
  var client2 = xmlrpc.createClient(config);
  var result = new Future();
  console.log(config);
  client.methodCall('login', [ config.login, config.pass ], function(err, sessionId) {
  if (err) {
  console.log("Login Error: " + err);
  response = {
  successful : false,
  error: err.message
}
} else {
console.log('session-id:' + sessionId);
response = {
successful: true,
client: client
}
}
return result.return(response);
});
return result.wait();
*/
}

export const methods = {
  "magento-import/methods/testConnection": function (settings) {
    check(settings, Object);
    //MagentoImportStatus.insert({product_status: 'Ready'});
    return magentoLogin(settings);
  },
  "magento-import/methods/getCategories": function(settings) {
    var result = magentoLogin();
    var client = result.client;
    var sessionId = client.options.sessionId;
    var categories = new Future();
    client.methodCall('call', [sessionId, 'catalog_category.tree'], function(err, result){
      categories.return(result);
    })
    return categories.wait();
  },
  "magento-import/methods/getStores": function(settings) {
    var result = magentoLogin();
    var client = result.client;
    var sessionId = client.options.sessionId;
    var stores = new Future();
    client.methodCall('call', ['store.list'], function(err, result){
      stores.return(result);
    })
    return stores.wait();
  },
  "magento-import/methods/importProducts": function (settings) {
    updateStatus({product_status: 'Importing...'});

    magento = MagentoJS(getMagentoConfig(settings));
    //var storeId = magento.options.storeId;

    var magentoInit = Meteor.wrapAsync(magento.init, magento);
    magentoInit(function(err) {
      //get product list
      var productList = new Future();
      magento.catalog_product.list(function(err, products) {
        productList.return(products);
      });

      var products=productList.wait().slice(1,3);
      //grab data for each product in list and add to reaction
      products.forEach(function(data) {
        var productInfo = new Future();
        magento.catalog_product.info(data.product_id, function(err, product){
          productInfo.return(product);
        });
        var product = productInfo.wait();
        console.log(product);
        /*var productId = Meteor.call("products/createProduct", (error, productId) => {
        if (error) {
        throw new Meteor.Error("create-product-error", error);
      }
      return productId;
    });
    Meteor.call("products/updateProductField", productId, "label", product.name);
    */

    var productId = Products.insert({
      type: "simple", // needed for multi-schema
      title: product.name,
      pageTitle: product.name,
      description: product.description,
      magento_import: true
    }, {
      validate: false
    }, (error, result) => {
      // additionally, we want to create a variant to a new product
      if (result) {
        Products.insert({
          ancestors: [result],
          price: product.price,
          title: "",
          type: "variant" // needed for multi-schema
        });
      }
    });
    console.log(productId);
  })
  return;
})
}
}


Meteor.methods(methods);
