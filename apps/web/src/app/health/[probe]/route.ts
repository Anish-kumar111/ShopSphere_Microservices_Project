// Liveness / readiness probes for the ALB target group, ECS and Kubernetes:
// GET /health/live and GET /health/ready
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ probe: string }> }) {
  const { probe } = await params;
  if (probe !== "live" && probe !== "ready") {
    return new Response(null, { status: 404 });
  }
  return Response.json({ status: "ok" });
}
