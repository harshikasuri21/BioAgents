import { type Project } from "@elizaos/core";
import "dotenv/config";

import { dkgAgent } from "./scholar";

const project: Project = {
  agents: [dkgAgent],
};

export default project;
