import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.setflow.fitness",
  appName: "SetFlow",
  webDir: "dist",
  backgroundColor: "#11130f",
  loggingBehavior: "debug",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_setflow",
      iconColor: "#C8FF3D",
    },
  },
};

export default config;
