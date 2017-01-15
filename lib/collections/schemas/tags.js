import { SimpleSchema } from "meteor/aldeed:simple-schema";
import * as Schemas from "/lib/collections/schemas";
import { Tags } from "/lib/collections/"

Tags.attachSchema([Schemas.Tag, {
  magento_category_id: {
    type: String,
    optional: true
  }}
])
