import { _generateMetadata } from "app/_utils";
import Forms from "../apps/routing-forms/forms/[[...pages]]/Forms";

const generateMetadata = async () => {
  return await _generateMetadata(
    (t) => `${t("routing_forms")} | Cal.com Forms`,
    () => "",
    undefined,
    undefined,
    `/routing`
  );
};

const ServerPage = async () => {
  return <Forms appUrl="/routing" />;
};

export { generateMetadata };
export default ServerPage;
