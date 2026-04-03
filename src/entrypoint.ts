export async function runCliEntrypoint(
  argv: string[],
  runServer: () => Promise<void>,
  runInstaller: () => Promise<void>
): Promise<void> {
  if (argv[0] === "install") {
    await runInstaller();
    return;
  }

  await runServer();
}
