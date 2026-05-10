const REGIONS = ["us-east", "eu-west", "ap-south"];

export async function runConsensusProposal(transaction) {
  const votes = REGIONS.map((region) => ({ region, vote: Number(transaction.risk || 0) <= 0.8 ? "YES" : "NO" }));
  const yes = votes.filter((v) => v.vote === "YES").length;
  const quorum = yes >= 2;
  return { quorum, votes, proposalId: `prop_${Date.now()}` };
}
