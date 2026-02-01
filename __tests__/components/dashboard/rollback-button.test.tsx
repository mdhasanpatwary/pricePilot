import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RollbackButton } from "@/components/dashboard/rollback-button";

// Mock fetch
global.fetch = jest.fn();

describe("RollbackButton", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.alert
        global.alert = jest.fn();
    });

    it("renders rollback button", () => {
        render(<RollbackButton updateLogId="test-id" />);

        const button = screen.getByRole("button", { name: /rollback/i });
        expect(button).toBeInTheDocument();
    });

    it("opens confirmation dialog when clicked", async () => {
        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
                oldPrice="99.99"
                newPrice="89.99"
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();
        });
    });

    it("displays product details in dialog for single rollback", async () => {
        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
                oldPrice="99.99"
                newPrice="89.99"
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText("Test Product")).toBeInTheDocument();
            expect(screen.getByText("$89.99")).toBeInTheDocument();
            expect(screen.getByText("$99.99")).toBeInTheDocument();
        });
    });

    it("displays product count for bulk rollback", async () => {
        render(
            <RollbackButton
                snapshotId="snapshot-id"
                productCount={25}
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText("25")).toBeInTheDocument();
            expect(screen.getByText(/products affected/i)).toBeInTheDocument();
        });
    });

    it("calls API and shows success on rollback", async () => {
        const mockFetch = global.fetch as jest.Mock;
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    message: "Rollback completed successfully",
                },
            }),
        });

        const onSuccess = jest.fn();

        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
                onSuccess={onSuccess}
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: /confirm rollback/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                "/api/v1/price-update/rollback",
                expect.objectContaining({
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        updateLogId: "test-id",
                        snapshotId: undefined,
                    }),
                })
            );
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it("displays error message on rollback failure", async () => {
        const mockFetch = global.fetch as jest.Mock;
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                success: false,
                error: {
                    message: "Cannot rollback: subsequent changes exist",
                },
            }),
        });

        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: /confirm rollback/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText(/cannot rollback: subsequent changes exist/i)).toBeInTheDocument();
        });
    });

    it("disables button while loading", async () => {
        const mockFetch = global.fetch as jest.Mock;
        mockFetch.mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(
                        () =>
                            resolve({
                                ok: true,
                                json: async () => ({ success: true, data: {} }),
                            }),
                        100
                    )
                )
        );

        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole("button", { name: /confirm rollback/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText(/rolling back/i)).toBeInTheDocument();
        });
    });

    it("allows canceling the rollback", async () => {
        render(
            <RollbackButton
                updateLogId="test-id"
                productTitle="Test Product"
            />
        );

        const button = screen.getByRole("button", { name: /rollback/i });
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText(/confirm rollback/i)).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(screen.queryByText(/confirm rollback/i)).not.toBeInTheDocument();
        });
    });
});
