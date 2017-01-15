import { Reaction } from "/server/api";
import { Packages } from "/lib/collections";
import { Products } from "/lib/collections";
import { Media } from "/lib/collections";
import { Tags } from "/lib/collections";
import { MagentoImportStatus } from "../lib/collections/schemas";
import { ReactionProduct, getSlug } from "/lib/api";
import Future from 'fibers/future';
import MagentoJS from "magentojs"

function updateStatus(value) {
  MagentoImportStatus.update({shopId: Reaction.getShopId()}, {$set: value}, {upsert: true});
};

function updateLog(value, textType) {
  var log = MagentoImportStatus.findOne({shopId: Reaction.getShopId()}).import_log || "";
  switch (textType) {
    case 'bold':
      value = '<b>' + value + '</b>';
      break;
    case 'header':
      value = '<h3>' + value + '</h3>';
      break;
  }
  MagentoImportStatus.update({shopId: Reaction.getShopId()}, {$set: {import_log: log + "<br>" + value}}, {upsert: true});
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
      categoryId: magento.settings.category,
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
};

function createTagRelationships(categoryTree) {
  var tagList = [];
  console.log(categoryTree);
  categoryTree.forEach(function(parent) {
    var parentTagId = Tags.findOne({magento_category_id: parent.category_id})._id;
    parent.children.forEach(function(child) {
      var childTagId = Tags.findOne({magento_category_id: child.category_id})._id;
      tagList.push(childTagId);
      createTagRelationships(child.children);
    });
    Tags.update(parentTagId, {$set: {
      relatedTagIds: tagList}
    })
    tagList = [];
  })
}

function createTags(categoryTree) {
  categoryTree.forEach(function(data) {
    if (data.level == 2) {
      var isTopLevel = true;
    } else { var isTopLevel = false};
    var updatedAt = new Date;
    var slug = getSlug(data.name);
    var existingTag = Tags.findOne({magento_category_id: data.category_id })
    if (!existingTag) {
      var newTag = Tags.insert({
        name: data.name,
        position: data.level,
        slug: slug,
        isTopLevel: isTopLevel,
        shopId: Reaction.getShopId(),
        updatedAt: updatedAt,
        magento_category_id: data.category_id
      });
    }
    if (data.children) {
      createTags(data.children);
    };
  })
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

    magento = MagentoJS(getMagentoConfig(settings));
    updateStatus({product_status: 'Connecting...'});
    updateLog('Connecting to ' + magento.MagentoClient.options.host + '...');

    var storeId = magento.MagentoClient.options.storeId;
    var categoryId = magento.MagentoClient.options.categoryId;
    var magentoInit = Meteor.wrapAsync(magento.init, magento);

    magentoInit(function(err) {
      updateLog('Connected to ' + magento.MagentoClient.options.host + '.', 'bold');
      //set store
      var setStore = new Future();
      magento.catalog_product.currentStore(storeId, function(err, store) {
        setStore.return (store)
      });
      var stores = setStore.wait();

      //get list of manufacturers
      updateStatus({product_status: 'Getting manufacturer list...'});
      updateLog('Getting manufacturer list...', 'header');
      var manufacturerList = new Future();
      magento.catalog_product_attribute.info("manufacturer", function(err, manufacturers){
        manufacturerList.return(manufacturers);
      });
      var manufacturers = manufacturerList.wait();
      updateLog('Finished getting manufacturer list.', 'bold')
      //get list of categories
      updateStatus({product_status: 'Getting category tree...'});
      updateLog('Getting category tree...', 'header')
      var categoryStore = new Future();
      magento.catalog_category.currentStore(storeId, function(err, storeId) {
        categoryStore.return(storeId)
      });
      console.log(categoryStore.wait());

      var categoryList = new Future();
      magento.catalog_category.tree(categoryId, function(err, categories) {
        categoryList.return(categories);
      })
      console.log(categoryList.wait());
      updateLog('Finished getting category tree.', 'bold')
      updateLog('Converting Magento categories to tags...', 'header')
      var categories = createTags([categoryList.wait()], null);
      var categoryRelationships = createTagRelationships([categoryList.wait()]);
      updateLog('Finished converting Magento categories to tags.','bold')
      //get product list
      updateStatus({product_status: 'Getting product list...'});
      updateLog('Getting product list...', 'header')
      var productList = new Future();
      magento.catalog_product.list([], storeId, function(err, products) {
        productList.return(products);
      });

      //var proudctList = productList.wait();
      //TESTING: slice the array and only update 3 active products:
      //_.reject(productList, function(data) { return data.status === "2"; });

      var products=productList.wait().slice(0,3);
      updateLog('Finished getting product list.','bold')
      //grab data for each product in list and add to reaction
      updateLog('Importing products.','header');
      var productCount = _.size(products);
      var productNum = 1;
      products.forEach(function(data) {
        updateStatus({product_status: "Adding product " + productNum + " of " + productCount});
        updateLog('Adding product ' + data.name + '(' + productNum + ' of ' + productCount + ')', 'bold')
        productNum = productNum + 1;

        var productInfo = new Future();
        magento.catalog_product.info(data.product_id, function(err, product){
          productInfo.return(product);
        });
        var product = productInfo.wait();
        console.log(product);

        var manufacturer = _.find(manufacturers.options, function(obj) { return obj.value == product.manufacturer })
        var tags = Tags.find({magento_category_id: {$in: product.categories}}).fetch().map(function (obj) { return obj._id});
        var variantId;
        var productId = Products.insert({
          type: "simple", // needed for multi-schema
          title: product.name,
          isVisible: true,
          pageTitle: product.name,
          description: product.description,
          price: product.price,
          vendor: manufacturer.label,
          magento_product_id: product.product_id,
          hashtags: tags
        }, {
          validate: false
        }
      );
      //product images
      updateLog('Adding ' + data.name + ' images.')
      var productImages = new Future();
      magento.catalog_product_attribute_media.list(product.product_id, function(err, images) {
        productImages.return(images);
      })
      var images = productImages.wait();
      console.log(images);
      images.forEach(function(data) {
        let fileObj;
        let toGrid = 0;
        if (data.position == 1) { toGrid =  1};
        fileObj = new FS.File(data.url);
        fileObj.metadata = {
          ownerId: Meteor.userId,
          productId: productId,
          variantId: productId,
          shopId: Reaction.getShopId(),
          priority: data.position,
          toGrid: toGrid
        };
        console.log(fileObj);
        console.log(toGrid);
        Media.insert(fileObj);
      });
      updateLog('Finished adding ' + data.name + ' images.')

      //product options (i.e. variants)
      updateLog('Adding ' + data.name + ' options (variants).');
      var productVariants = new Future();
      magento.catalog_product_custom_option.list(product.product_id, (function(err, variants) {
        productVariants.return(variants)
      }));
      productVariants.wait().forEach(function(variant) {
        var variantId = Products.insert({
          ancestors: [productId],
          title: variant.title,
          type: "variant" // needed for multi-schema
        });
        //get variant options
        var productOptions = new Future();
        magento.catalog_product_custom_option.info(variant.option_id, function(err, options) {
          productOptions.return(options);
        });
        console.log(productOptions.wait());
        productOptions.wait().additional_fields.forEach(function(option) {
          console.log(option);
          Products.insert({
            ancestors: [productId, variantId],
            optionTitle: option.title,
            label: option.title,
            price:product.price,
            sku: option.sku,
            type: "variant"
          })
        });
        updateLog('Finished adding ' + data.name + ' options.');
        updateLog('Finished adding ' + data.name + '.', 'bold');
      });
    });
    updateStatus({product_status: "Finished product import!"});
    updateLog('Finished product import!', 'header');
    return;
  })
},
"magento-import/methods/deleteMagentoProducts": function () {
  updateStatus({product_status: "Deleting..."});
  Products.find({magento_product_id: {$ne: null}}).fetch().forEach(function(data){
    Media.remove({productId: data._id});
  });
  Products.remove({magento_product_id: {$ne: null}});
  Tags.remove({magento_category_id: {$ne: null}})
  updateStatus({product_status: "Ready"});
  updateStatus({import_log: ""});

  return;
},


}


Meteor.methods(methods);
