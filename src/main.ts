import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./styles/main.css";
import { useUserStore } from "./store/userStore";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 启动时恢复登录态
useUserStore().init();

app.mount("#app");
