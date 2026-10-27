import { fileURLToPath } from "node:url"
import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  publicDir: "assets",
  manifest: {
    name: "VaultKey Password Manager",
    description: "Zero-knowledge password manager with generator, secure autofill and encrypted sync.",
    version: "1.0.0",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoIQbeOX9TjGuKzR/lYM3MfYecU6SdKWlptWXQkpKHsWOHlvJ7pykDngmFKZ7xjf5gUane3eeFRqxyde/X8BoVrf33exD4dj9RhV+m8aTwReAMfeWngcctN6Qo1gkAdVtqQYmDOBNKdqpdmDSpIfrOAgVby1iRAjYAk/LUyZvg2CmL3WdzCU/BF0oY0S2XvrpgekCPfZDkzV/kV/yCB5XPaHncMJbAWV/ZEkQsXqdJxi+eKl8Jdg2H6TqDF2DMGey333Xc1A/uo2A+gZ6bES8VFEe8O+vBlLhHCblm3O9svFk7x2SwA9y0gh6/83b1XhxE1d1XB2NT1N5dLtj1HqpJQIDAQAB",
    browser_specific_settings: {
      gecko: {
        id: "{359a023e-6cc7-4af6-9986-9d6d1dde3981}",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["authenticationInfo", "personallyIdentifyingInfo"]
        }
      }
    },
    icons: { 128: "icon.png" },
    host_permissions: ["http://localhost:4000/*", "https://*/*", "http://*/*"],
    permissions: ["storage", "alarms", "activeTab"],
    action: { default_title: "VaultKey", default_icon: "icon.png" }
  },
  vite: () => ({
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./src", import.meta.url))
      }
    }
  })
})
