import { getPlatformProxy } from "wrangler";
async function main() {
  const proxy = await getPlatformProxy();
  try {
    await proxy.env.VECTORIZE.insert([{ id: "test", values: [0.1, 0.2] }]);
    console.log("Insert success!");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  await proxy.dispose();
}
main().catch(console.error);
