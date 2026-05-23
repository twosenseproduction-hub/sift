import "dotenv/config";
import { runSendDailyPromptsJob } from "./send-daily-prompts";

runSendDailyPromptsJob()
  .then((result) => {
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((err) => {
    console.error("[daily-prompt-job] fatal", err);
    process.exitCode = 1;
  });
