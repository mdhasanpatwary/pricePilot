<?php
/**
 * PricePilot Error Handling Service
 * Path: catalog/model/extension/pricepilot/ErrorHandlingService.php
 * 
 * Provides structured error handling with HTTP status codes and consistent
 * JSON error response formatting. All API errors should use this service
 * to ensure consistent error responses across all endpoints.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

require_once(__DIR__ . '/Service.php');

class ErrorHandlingService extends Service {
    
    // Error code constants
    const ERROR_INVALID_PARAMETER = 'INVALID_PARAMETER';
    const ERROR_AUTH_FAILED = 'AUTH_FAILED';
    const ERROR_NOT_FOUND = 'NOT_FOUND';
    const ERROR_RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED';
    const ERROR_PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE';
    const ERROR_INTERNAL_ERROR = 'INTERNAL_ERROR';
    const ERROR_INVALID_JSON = 'INVALID_JSON';
    const ERROR_MISSING_PARAMETER = 'MISSING_PARAMETER';
    const ERROR_FORBIDDEN = 'FORBIDDEN';
    const ERROR_METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED';
    
    // HTTP status code constants
    const HTTP_OK = 200;
    const HTTP_BAD_REQUEST = 400;
    const HTTP_UNAUTHORIZED = 401;
    const HTTP_FORBIDDEN = 403;
    const HTTP_NOT_FOUND = 404;
    const HTTP_METHOD_NOT_ALLOWED = 405;
    const HTTP_PAYLOAD_TOO_LARGE = 413;
    const HTTP_TOO_MANY_REQUESTS = 429;
    const HTTP_INTERNAL_SERVER_ERROR = 500;
    
    /**
     * Send error response with appropriate HTTP status code
     * 
     * @param string $errorCode Error code constant (e.g., ERROR_INVALID_PARAMETER)
     * @param string $message Human-readable error message
     * @param int $statusCode HTTP status code
     * @param array|null $details Optional additional error details
     * @param bool $logError Whether to log this error (default: true)
     * @return void
     */
    public function sendErrorResponse($errorCode, $message, $statusCode, $details = null, $logError = true) {
        // Build error response structure
        $response = array(
            'error' => $message,
            'code' => $errorCode
        );
        
        // Add details if provided
        if ($details !== null && !empty($details)) {
            $response['details'] = $details;
        }
        
        // Log error if enabled
        if ($logError) {
            $this->logError($errorCode, $message, $statusCode, $details);
        }
        
        // Set HTTP status code header
        $this->setHttpStatusCode($statusCode);
        
        // Set content type header
        $this->response->addHeader('Content-Type: application/json');
        
        // Send JSON response
        $this->response->setOutput(json_encode($response));
    }
    
    /**
     * Send success response with HTTP 200 status
     * 
     * @param array $data Response data
     * @return void
     */
    public function sendSuccessResponse($data) {
        // Set HTTP 200 status code
        $this->setHttpStatusCode(self::HTTP_OK);
        
        // Set content type header
        $this->response->addHeader('Content-Type: application/json');
        
        // Send JSON response
        $this->response->setOutput(json_encode($data));
    }
    
    /**
     * Send validation error response (HTTP 400)
     * 
     * @param string $message Error message
     * @param array|null $details Field-specific validation errors
     * @return void
     */
    public function sendValidationError($message, $details = null) {
        $this->sendErrorResponse(
            self::ERROR_INVALID_PARAMETER,
            $message,
            self::HTTP_BAD_REQUEST,
            $details
        );
    }
    
    /**
     * Send authentication error response (HTTP 401)
     * 
     * @param string $message Error message (default: 'Invalid API Token')
     * @return void
     */
    public function sendAuthenticationError($message = 'Invalid API Token') {
        $this->sendErrorResponse(
            self::ERROR_AUTH_FAILED,
            $message,
            self::HTTP_UNAUTHORIZED
        );
    }
    
    /**
     * Send forbidden error response (HTTP 403)
     * 
     * @param string $message Error message
     * @return void
     */
    public function sendForbiddenError($message = 'Access forbidden') {
        $this->sendErrorResponse(
            self::ERROR_FORBIDDEN,
            $message,
            self::HTTP_FORBIDDEN
        );
    }
    
    /**
     * Send not found error response (HTTP 404)
     * 
     * @param string $message Error message
     * @return void
     */
    public function sendNotFoundError($message = 'Resource not found') {
        $this->sendErrorResponse(
            self::ERROR_NOT_FOUND,
            $message,
            self::HTTP_NOT_FOUND
        );
    }
    
    /**
     * Send rate limit error response (HTTP 429)
     * 
     * @param int $retryAfter Seconds until rate limit resets
     * @return void
     */
    public function sendRateLimitError($retryAfter) {
        // Add Retry-After header
        $this->response->addHeader('Retry-After: ' . $retryAfter);
        
        $this->sendErrorResponse(
            self::ERROR_RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded. Please try again later.',
            self::HTTP_TOO_MANY_REQUESTS,
            array('retry_after' => $retryAfter)
        );
    }
    
    /**
     * Send payload too large error response (HTTP 413)
     * 
     * @param string $message Error message
     * @return void
     */
    public function sendPayloadTooLargeError($message = 'Request payload too large') {
        $this->sendErrorResponse(
            self::ERROR_PAYLOAD_TOO_LARGE,
            $message,
            self::HTTP_PAYLOAD_TOO_LARGE
        );
    }
    
    /**
     * Send internal server error response (HTTP 500)
     * 
     * @param string $message Error message (generic for security)
     * @param Exception|null $exception Optional exception for logging
     * @return void
     */
    public function sendInternalError($message = 'An internal error occurred', $exception = null) {
        $details = null;
        
        // Log exception details if provided
        if ($exception !== null) {
            $this->logException($exception);
            
            // In development mode, include exception details
            if ($this->config->get('config_error_display')) {
                $details = array(
                    'exception' => get_class($exception),
                    'message' => $exception->getMessage(),
                    'file' => $exception->getFile(),
                    'line' => $exception->getLine()
                );
            }
        }
        
        $this->sendErrorResponse(
            self::ERROR_INTERNAL_ERROR,
            $message,
            self::HTTP_INTERNAL_SERVER_ERROR,
            $details
        );
    }
    
    /**
     * Send missing parameter error response (HTTP 400)
     * 
     * @param string $parameterName Name of missing parameter
     * @return void
     */
    public function sendMissingParameterError($parameterName) {
        $this->sendErrorResponse(
            self::ERROR_MISSING_PARAMETER,
            "Missing required parameter: {$parameterName}",
            self::HTTP_BAD_REQUEST,
            array('parameter' => $parameterName)
        );
    }
    
    /**
     * Send invalid JSON error response (HTTP 400)
     * 
     * @param string $message Error message
     * @return void
     */
    public function sendInvalidJsonError($message = 'Invalid JSON payload') {
        $this->sendErrorResponse(
            self::ERROR_INVALID_JSON,
            $message,
            self::HTTP_BAD_REQUEST
        );
    }
    
    /**
     * Set HTTP status code header
     * 
     * @param int $statusCode HTTP status code
     * @return void
     */
    private function setHttpStatusCode($statusCode) {
        $statusTexts = array(
            200 => 'OK',
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            413 => 'Payload Too Large',
            429 => 'Too Many Requests',
            500 => 'Internal Server Error'
        );
        
        $statusText = isset($statusTexts[$statusCode]) ? $statusTexts[$statusCode] : 'Unknown';
        
        // Set HTTP status header
        if (function_exists('http_response_code')) {
            http_response_code($statusCode);
        } else {
            $protocol = isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.1';
            header("{$protocol} {$statusCode} {$statusText}");
        }
    }
    
    /**
     * Log error to system log
     * 
     * @param string $errorCode Error code
     * @param string $message Error message
     * @param int $statusCode HTTP status code
     * @param array|null $details Error details
     * @return void
     */
    private function logError($errorCode, $message, $statusCode, $details = null) {
        $logMessage = sprintf(
            'API Error [%s] HTTP %d: %s',
            $errorCode,
            $statusCode,
            $message
        );
        
        if ($details !== null) {
            $logMessage .= ' | Details: ' . json_encode($details);
        }
        
        // Add request context
        $ip = $this->getClientIp();
        $endpoint = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : 'unknown';
        $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'unknown';
        
        $logMessage .= sprintf(' | IP: %s | Endpoint: %s | Method: %s', $ip, $endpoint, $method);
        
        $this->logMessage($logMessage, 'error');
    }
    
    /**
     * Log exception with stack trace
     * 
     * @param Exception $exception Exception to log
     * @return void
     */
    private function logException($exception) {
        $logMessage = sprintf(
            'Exception: %s in %s:%d | Message: %s | Trace: %s',
            get_class($exception),
            $exception->getFile(),
            $exception->getLine(),
            $exception->getMessage(),
            $exception->getTraceAsString()
        );
        
        $this->logMessage($logMessage, 'error');
    }
    
    /**
     * Get client IP address
     * 
     * @return string Client IP address
     */
    private function getClientIp() {
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
        } elseif (isset($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (isset($_SERVER['REMOTE_ADDR'])) {
            $ip = $_SERVER['REMOTE_ADDR'];
        } else {
            $ip = 'unknown';
        }
        
        return $ip;
    }
    
    /**
     * Get error code for HTTP status
     * 
     * @param int $statusCode HTTP status code
     * @return string Error code constant
     */
    public function getErrorCodeForStatus($statusCode) {
        $mapping = array(
            self::HTTP_BAD_REQUEST => self::ERROR_INVALID_PARAMETER,
            self::HTTP_UNAUTHORIZED => self::ERROR_AUTH_FAILED,
            self::HTTP_FORBIDDEN => self::ERROR_FORBIDDEN,
            self::HTTP_NOT_FOUND => self::ERROR_NOT_FOUND,
            self::HTTP_METHOD_NOT_ALLOWED => self::ERROR_METHOD_NOT_ALLOWED,
            self::HTTP_PAYLOAD_TOO_LARGE => self::ERROR_PAYLOAD_TOO_LARGE,
            self::HTTP_TOO_MANY_REQUESTS => self::ERROR_RATE_LIMIT_EXCEEDED,
            self::HTTP_INTERNAL_SERVER_ERROR => self::ERROR_INTERNAL_ERROR
        );
        
        return isset($mapping[$statusCode]) ? $mapping[$statusCode] : self::ERROR_INTERNAL_ERROR;
    }
}
