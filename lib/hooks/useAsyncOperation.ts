/**
 * Custom hook for managing async operations with loading, error, and retry states
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface AsyncOperationState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    isSuccess: boolean;
    isError: boolean;
}

export interface AsyncOperationOptions {
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
    onSuccess?: (data: any) => void;
    onError?: (error: Error) => void;
}

export function useAsyncOperation<T = any>(
    options: AsyncOperationOptions = {}
) {
    const [state, setState] = useState<AsyncOperationState<T>>({
        data: null,
        loading: false,
        error: null,
        isSuccess: false,
        isError: false,
    });

    const execute = useCallback(
        async (asyncFn: () => Promise<T>) => {
            setState({
                data: null,
                loading: true,
                error: null,
                isSuccess: false,
                isError: false,
            });

            try {
                const result = await asyncFn();

                setState({
                    data: result,
                    loading: false,
                    error: null,
                    isSuccess: true,
                    isError: false,
                });

                if (options.showSuccessToast && options.successMessage) {
                    toast.success(options.successMessage);
                }

                if (options.onSuccess) {
                    options.onSuccess(result);
                }

                return { success: true, data: result };
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Operation failed";

                setState({
                    data: null,
                    loading: false,
                    error: errorMessage,
                    isSuccess: false,
                    isError: true,
                });

                if (options.showErrorToast) {
                    toast.error(errorMessage);
                }

                if (options.onError && error instanceof Error) {
                    options.onError(error);
                }

                return { success: false, error: errorMessage };
            }
        },
        [options]
    );

    const reset = useCallback(() => {
        setState({
            data: null,
            loading: false,
            error: null,
            isSuccess: false,
            isError: false,
        });
    }, []);

    return {
        ...state,
        execute,
        reset,
    };
}
