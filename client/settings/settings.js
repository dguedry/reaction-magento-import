import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Blaze } from "meteor/blaze";
import { AutoForm } from "meteor/aldeed:autoform";
import { Template } from "meteor/templating";
import { Reaction } from "/client/api";
import { Packages } from "/lib/collections";
import { MagentoImportPackageConfig } from "../../lib/collections/schemas";
import { MagentoImportStatus } from "../../lib/collections/schemas";

import "./settings.html";

Template.magentoImportSettings.helpers({
  MagentoImportPackageConfig() {
    return MagentoImportPackageConfig;
  },
  packageData() {
    return Packages.findOne({
      name: "magento-import",
      shopId: Reaction.getShopId()
    });
  },
});

Template.magentoImportSettings.events({
  "click [data-event-action=testConnection]"(event) {
    event.preventDefault();
    event.stopPropagation();
    var settings = {
      host: $('input[data-schema-key="settings.host"]').val(),
      port: $('input[data-schema-key="settings.port"]').val(),
      path: $('input[data-schema-key="settings.path"]').val(),
      user: $('input[data-schema-key="settings.user"]').val(),
      password: $('input[data-schema-key="settings.password"]').val(),
    };
    Meteor.call("magento-import/methods/testConnection", settings, function(err, result){
      if (result.successful) {
        Alerts.alert({
          title: "Connected Successfully!",
          type: "info",
          showCancelButton: false,
        });
      } else {
        Alerts.alert({
          title: result.error,
          type: "error",
          showCancelButton: false,
        });
      }
    })
  }
});

AutoForm.hooks({
  "magento-update-form": {
    onSuccess: function () {
      Alerts.removeSeen();
      return Alerts.add("Magento settings saved. ", "success");
    },
    onError: function (operation, error) {
      Alerts.removeSeen();
      return Alerts.add("Magento import settings update failed. " + error, "danger");
    }
  }
});

Template.magentoImportTable.onCreated(function () {
  this.subscribe("MagentoImportStatus");
});

Template.magentoImportTable.helpers({
  productImportStatus: function() {
    return MagentoImportStatus.findOne({shopId: Reaction.getShopId()}).product_status;
  },
  storeList: function() {
    Meteor.call("magento-import/methods/getStores", function(err, result) {
      if (result) {
        var storeList = [];
        result.forEach(function(data) {
          storeList.push({label: data.name, value: data.store_id})
        })
        return storeList;
      } else {
        return
      }
    })
  }
});

Template.magentoImportTable.events({
  "click [data-event-action=importProducts]"(event) {
    Meteor.call("magento-import/methods/importProducts", function(err, result){
      if (result.successful) {
        Alerts.alert({
          title: "Connected Successfully!",
          type: "info",
          showCancelButton: false,
        });
      } else {
        Alerts.alert({
          title: result.error,
          type: "error",
          showCancelButton: false,
        });
      }
    });
  },
  "click [data-event-action=removeImportedProducts]"(event) {
    Meteor.call("magento-import/methods/deleteMagentoProducts", function(err, result){
      if (err) {
        Alerts.alert({
          title: result.error,
          type: "error",
          showCancelButton: false,
        });
      }
    });
  }
});
