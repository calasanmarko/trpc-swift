import SampleConfig from "trpc-swift-sample/trpc-swift";
import { TRPCSwift } from "trpc-swift";

const swift = await new TRPCSwift(SampleConfig).root();
await Bun.write(`${import.meta.dir}/output/Test.swift`, swift);
