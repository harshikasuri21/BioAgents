import { IAgentRuntime } from "@elizaos/core";
import { sql } from "drizzle-orm";
import { type Route } from "@elizaos/core";

const query = sql`SELECT COUNT(*) AS total_agents FROM agents`;

async function getTotalAgents(runtime: IAgentRuntime): Promise<BigInt> {
  const totalAgents = await runtime.db.execute(query);
  return totalAgents.rows[0].total_agents as BigInt;
}

export const totalAgents: Route = {
  path: "/totalAgents",
  type: "GET",
  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    const totalAgents = await getTotalAgents(runtime);
    res.json({
      result: totalAgents,
    });
  },
};
