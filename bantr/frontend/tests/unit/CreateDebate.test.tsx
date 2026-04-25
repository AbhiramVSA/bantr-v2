import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateDebate } from "../../src/pages/CreateDebate";
import { createDebate } from "../../src/services/debates";

vi.mock("../../src/services/debates", () => ({
  createDebate: vi.fn(),
}));

const mockedCreateDebate = vi.mocked(createDebate);

describe("CreateDebate", () => {
  beforeEach(() => {
    mockedCreateDebate.mockReset();
  });

  it("submits the labeled debate form once while pending", async () => {
    const user = userEvent.setup();
    mockedCreateDebate.mockReturnValue(
      new Promise<Awaited<ReturnType<typeof createDebate>>>(() => undefined),
    );

    render(
      <MemoryRouter>
        <CreateDebate />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Title"), "Finals");
    await user.clear(screen.getByLabelText("Agent Voice ID"));
    await user.type(screen.getByLabelText("Agent Voice ID"), "demo-voice");
    await user.type(screen.getByLabelText("Topic"), "Resolved: tests matter");
    await user.type(screen.getByLabelText("Agent Prompt"), "Argue clearly.");
    const form = screen.getByRole("button", { name: "Create Debate" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(mockedCreateDebate).toHaveBeenCalledTimes(1);
    expect(mockedCreateDebate).toHaveBeenCalledWith({
      title: "Finals",
      topic: "Resolved: tests matter",
      agent_prompt: "Argue clearly.",
      agent_voice_id: "demo-voice",
    });
  });
});
