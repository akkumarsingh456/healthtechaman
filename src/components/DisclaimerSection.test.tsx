import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invoke = vi.fn();
const insert = vi.fn();
const rpc = vi.fn();
const removeChannel = vi.fn();
let realtimeInsertHandler: (() => void) | undefined;
const realtimeChannel = {
  on: vi.fn((_event: string, _filter: unknown, handler: () => void) => {
    realtimeInsertHandler = handler;
    return realtimeChannel;
  }),
  subscribe: vi.fn(() => realtimeChannel),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({ insert: (...a: unknown[]) => insert(...a) }),
    rpc: (...a: unknown[]) => rpc(...a),
    channel: () => realtimeChannel,
    removeChannel: (...a: unknown[]) => removeChannel(...a),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import DisclaimerSection from "./DisclaimerSection";

const NAME = "sudipta";
const EMAIL = "akprojectconnect2025@gmail.com";
const SUBJECT = "the ui is very nice";
const MESSAGE = "I really liked the health centre portal, please keep improving it.";

let clickedHrefs: string[] = [];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clickedHrefs = [];
  invoke.mockReset();
  insert.mockReset();
  rpc.mockReset();
  removeChannel.mockReset();
  realtimeChannel.on.mockClear();
  realtimeChannel.subscribe.mockClear();
  realtimeInsertHandler = undefined;
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: [], error: null });
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clickedHrefs.push(this.getAttribute("href") ?? "");
    });
});

afterEach(() => {
  clickSpy.mockRestore();
});

async function fillContactForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Your Name"), NAME);
  await user.type(screen.getByPlaceholderText("Your Email"), EMAIL);
  await user.type(screen.getByPlaceholderText("Subject"), SUBJECT);
  await user.type(screen.getByPlaceholderText("Your Message"), MESSAGE);
}

function parseMailto(href: string) {
  expect(href.startsWith("mailto:")).toBe(true);
  const [to, query] = href.slice("mailto:".length).split("?");
  const params = new URLSearchParams(query);
  return { to, subject: params.get("subject") ?? "", body: params.get("body") ?? "" };
}

describe("DisclaimerSection — Save Message + Send Mail workflow", () => {
  it("Send Mail opens the mail client addressed to the owner with the exact name, subject and message", async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue({ data: null, error: null }); // no AI draft -> verbatim fallback
    render(<DisclaimerSection />);

    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /send mail/i }));

    await waitFor(() => expect(clickedHrefs).toHaveLength(1));

    const { to, subject, body } = parseMailto(clickedHrefs[0]);
    expect(to).toBe("akkumarsingh456@gmail.com");
    expect(subject).toBe(SUBJECT);
    expect(body).toContain(`Name: ${NAME}`);
    expect(body).toContain(`Email: ${EMAIL}`);
    expect(body).toContain(MESSAGE);
  });

  it("uses the Gemini-drafted subject and body when the composer returns one", async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue({
      data: { subject: SUBJECT, body: `Hello,\n\n${MESSAGE}\n\nRegards,\n${NAME}\n${EMAIL}`, ai: true },
      error: null,
    });
    render(<DisclaimerSection />);

    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /send mail/i }));

    await waitFor(() => expect(clickedHrefs).toHaveLength(1));
    const { to, subject, body } = parseMailto(clickedHrefs[0]);
    expect(to).toBe("akkumarsingh456@gmail.com");
    expect(subject).toBe(SUBJECT);
    expect(body).toContain(MESSAGE);
    expect(body).toContain(NAME);
    expect(invoke).toHaveBeenCalledWith("compose-contact-mail", {
      body: { name: NAME, email: EMAIL, subject: SUBJECT, message: MESSAGE },
    });
  });

  it("never stays stuck on Preparing… when the composer fails", async () => {
    const user = userEvent.setup();
    invoke.mockRejectedValue(new Error("network down"));
    render(<DisclaimerSection />);

    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /send mail/i }));

    await waitFor(() => expect(clickedHrefs).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /preparing/i })).not.toBeInTheDocument(),
    );
    const { to, body } = parseMailto(clickedHrefs[0]);
    expect(to).toBe("akkumarsingh456@gmail.com");
    expect(body).toContain(MESSAGE);
  });

  it("Save Message stores the exact same values in the backend", async () => {
    const user = userEvent.setup();
    render(<DisclaimerSection />);

    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: /save message/i }));

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert.mock.calls[0][0]).toMatchObject({
      submission_type: "contact",
      name: NAME,
      email: EMAIL,
      subject: SUBJECT,
      message: MESSAGE,
    });
  });

  it("refreshes public reviews immediately after a realtime review event", async () => {
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{
          id: "review-1",
          name: "New Reviewer",
          sender_role: "student",
          college_name: "NIT Warangal",
          branch: "Education",
          year: "2026",
          subject: null,
          rating: 5,
          message: "Realtime review message",
          created_at: "2026-08-03T17:00:00Z",
        }],
        error: null,
      });

    render(<DisclaimerSection />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(realtimeChannel.subscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      realtimeInsertHandler?.();
    });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  });
});
