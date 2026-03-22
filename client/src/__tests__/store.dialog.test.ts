import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../entities/match/model/store";

describe("Global Dialog Store Actions", () => {
  beforeEach(() => {
    // Reset store state before each test
    useGameStore.setState({
      confirmDialog: {
        isOpen: false,
        type: "alert",
        message: "",
        onConfirm: () => {},
      },
    });
  });

  it("should open a confirm dialog with correct data", () => {
    const onConfirm = () => {};
    useGameStore
      .getState()
      .showConfirm("Are you sure?", onConfirm, "Confirm Test");

    const state = useGameStore.getState().confirmDialog;
    expect(state.isOpen).toBe(true);
    expect(state.type).toBe("confirm");
    expect(state.message).toBe("Are you sure?");
    expect(state.title).toBe("Confirm Test");
  });

  it("should close the dialog when closeConfirm is called", () => {
    useGameStore.getState().showConfirm("Test", () => {});
    useGameStore.getState().closeConfirm();

    expect(useGameStore.getState().confirmDialog.isOpen).toBe(false);
  });

  it("should execute onConfirm and then close the dialog automatically", () => {
    let called = false;
    const onConfirm = () => {
      called = true;
    };

    useGameStore.getState().showConfirm("Action", onConfirm);

    // Trigger the stored onConfirm
    useGameStore.getState().confirmDialog.onConfirm();

    expect(called).toBe(true);
    expect(useGameStore.getState().confirmDialog.isOpen).toBe(false);
  });
});
