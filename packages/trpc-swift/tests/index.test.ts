import SampleConfig from "trpc-swift-sample/trpc-swift";
import { TRPCSwift } from "trpc-swift/src/index";

const swift = await new TRPCSwift(SampleConfig).root();
await Bun.write("./tests/output/Test.swift", swift);
