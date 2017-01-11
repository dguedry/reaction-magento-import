/* eslint camelcase: 0 */
import { Reaction } from "/server/api";

Reaction.registerPackage({
  label: "Magento Import",
  name: "magento-import",
  icon: "fa fa-cloud-download",
  autoEnable: true,
  settings: {
    mode: false,
    host: "",
    port: "",
    path: "",
    user: "",
    password: ""
  },
  registry: [
    // Dashboard card
    {
      provides: "dashboard",
      name: "magento-import",
      route: "/dashboard/magento-import",
      label: "Magento Import",
      description: "Import data from Magento 1.x",
      icon: "fa fa-cloud-download",
      priority: 4,
      container: "utilities",
      workflow: "coreDashboardWorkflow",
      template: "magentoImport"
    },
    {
      label: "Magento Import Settings",
      name: "magento-import/settings",
      provides: "settings",
      template: "magentoImportSettings"
    }
  ]
});
