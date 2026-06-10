type DisplayMessageBoxProps = {
  message?: string;
};

export const DisplayMessageBox = ({ message }: DisplayMessageBoxProps) => (
  <div className="display-message-box" aria-live="polite">
    {message ?? ""}
  </div>
);
