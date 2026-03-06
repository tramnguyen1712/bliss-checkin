import ResultClient from "./ResultClient";

export default async function CheckinResultPage({ searchParams }) {
  const params = await searchParams;
  const message = params?.message || "Check-in successful.";

  return <ResultClient message={message} />;
}
