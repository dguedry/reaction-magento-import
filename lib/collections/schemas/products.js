import { SimpleSchema } from "meteor/aldeed:simple-schema";
import * as Schemas from "/lib/collections/schemas";
import { Products } from "/lib/collections/";

Products.attachSchema([Schemas.Product, {
  magento_product_id: {
    type: String,
    optional: true
  }
}]);
Products.attachSchema([Schemas.ProductVariant, {
  magento_product_id: {
    type: String,
    optional: true
  }
}]);
