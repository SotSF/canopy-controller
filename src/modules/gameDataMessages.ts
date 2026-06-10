export const gameDataMessages: Record<number, string> = {
  0: "Hit!",
};

export const getGameDataMessage = (displayMessageId: number) =>
  gameDataMessages[displayMessageId];
