export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl bg-error-container/20 p-6 text-on-error-container">
      <h3 className="font-headline text-xl font-extrabold">{title}</h3>
      <p className="mt-2">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-error px-5 py-2 font-headline font-bold text-on-error"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
