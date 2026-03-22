import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { openiLinkPlugin } from "./src/channel.js";

type PluginModule = {
  id: string;
  name: string;
  description: string;
  configSchema: ReturnType<typeof emptyPluginConfigSchema>;
  register: (api: OpenClawPluginApi) => void;
};

const plugin: PluginModule = {
  id: "openilink",
  name: "OpenILink Channel",
  description: "WeChat messaging channel via OpenILink Hub",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    api.registerChannel({ plugin: openiLinkPlugin });
  },
};

export default plugin;
