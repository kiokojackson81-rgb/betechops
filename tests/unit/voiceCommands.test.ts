import { parseVoiceStaffCommand } from "@/lib/voiceCommands";

describe("voice staff command map", () => {
  test("uses hash to transfer and star to conference", () => {
    expect(parseVoiceStaffCommand("#2")).toEqual({ code: "#2", action: "TRANSFER", target: "JONATHAN" });
    expect(parseVoiceStaffCommand("*4")).toEqual({ code: "*4", action: "CONFERENCE", target: "BRENDAH" });
  });
  test("does not accept unsafe or incomplete commands", () => {
    expect(parseVoiceStaffCommand("4")).toBeNull();
    expect(parseVoiceStaffCommand("#9")).toBeNull();
  });
});
