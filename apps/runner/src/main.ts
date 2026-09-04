import { readFile, writeFile } from "node:fs/promises";
import { parseJobCreateInput, type JobCompletionInput } from "../../../packages/contracts/src/index.js";
import { renderMandelbrotSvg } from "../../../packages/core/src/mandelbrot.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (inputPath === undefined || outputPath === undefined) {
    throw new Error("Runner requires input and output file paths");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Runner input file is malformed", { cause: error });
  }
  const input = parseJobCreateInput(parsed);
  if (!input.ok) throw new Error(`Runner rejected workload: ${input.issues.join(", ")}`);

  const startedAt = Date.now();
  const svg = renderMandelbrotSvg(input.value.parameters);
  const completion: JobCompletionInput = {
    result: {
      mimeType: "image/svg+xml",
      dataBase64: Buffer.from(svg, "utf8").toString("base64")
    },
    metrics: {
      runtimeMs: Date.now() - startedAt,
      outputBytes: Buffer.byteLength(svg, "utf8")
    }
  };
  await writeFile(outputPath, JSON.stringify(completion), { encoding: "utf8", flag: "w" });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Runner failed with an unknown error");
  process.exitCode = 1;
});

