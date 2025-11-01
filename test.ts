import { t } from "./utils/i18n";

console.log(t("nl", "already_registered"));
// Output: Je bent al geregistreerd!

console.log(t("en", "greeting", { user: "Alice" }));
// Output: Hallo, Alice!
