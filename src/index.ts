import {
  logger,
  type Character,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import dotenv from "dotenv";
import starterPlugin from "./plugin";
dotenv.config({ path: "../../.env" });
import { dkgAgent } from "./scholar";

const project: Project = {
  agents: [dkgAgent],
};

export default project;
