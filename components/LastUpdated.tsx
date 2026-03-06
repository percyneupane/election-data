interface LastUpdatedProps {
  fetchedAtIso: string;
}

export function LastUpdated({ fetchedAtIso }: LastUpdatedProps): React.JSX.Element {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(fetchedAtIso));

  return <div className="last-updated">Last updated at {formatted}</div>;
}
