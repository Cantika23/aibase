"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvIdManager } from "@/lib/conv-id";
import { useConvId } from "@/lib/conv-id";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

/**
 * Example component demonstrating conversation ID usage patterns
 */
export function ConvIdExample() {
  const [serverResponse, setServerResponse] = useState<string>("");

  // Using the React hook (recommended for components)
  const {
    convId: hookConvId,
    setConvId,
    generateNewConvId,
    hasConvId,
    metadata
  } = useConvId();

  // Using the static class directly (useful for utility functions)
  const directConvId = ConvIdManager.getConvId();

  const simulateApiCall = async () => {
    try {
      // Example of including conversation ID in API request
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': hookConvId, // Include conversation ID in headers
        },
        body: JSON.stringify({
          message: "Hello from client",
          convId: hookConvId, // Include in request body
        }),
      });

      const data = await response.json();
      setServerResponse(`Server acknowledged conversation ID: ${data.convId}`);
    } catch (error) {
      setServerResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateConvId = () => {
    const newId = `custom_${Date.now()}`;
    setConvId(newId);
    setServerResponse(`Updated conversation ID to: ${newId}`);
  };

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Client ID Usage Examples
            <Badge variant="outline">React Hook</Badge>
          </CardTitle>
          <CardDescription>
            Demonstrating different ways to use conversation ID in components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hook-based usage */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">Using React Hook:</h4>
            <p className="font-mono text-sm mb-2">Hook Conversation ID: {hookConvId}</p>
            <p className="font-mono text-sm mb-2">Has Stored ID: {hasConvId ? "Yes" : "No"}</p>
            <p className="font-mono text-sm">Browser Environment: {metadata.isBrowserEnvironment ? "Yes" : "No"}</p>
          </div>

          {/* Direct class usage */}
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold mb-2">Using Static Class:</h4>
            <p className="font-mono text-sm mb-2">Direct Conversation ID: {directConvId}</p>
            <p className="font-mono text-sm">Has ID: {ConvIdManager.hasConvId() ? "Yes" : "No"}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateNewConvId} variant="outline">
              Generate New ID
            </Button>
            <Button onClick={updateConvId} variant="outline">
              Set Custom ID
            </Button>
            <Button onClick={simulateApiCall} variant="default">
              Simulate API Call
            </Button>
          </div>

          {/* Response display */}
          {serverResponse && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Response:</h4>
              <p className="text-sm">{serverResponse}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Patterns</CardTitle>
          <CardDescription>
            Common integration patterns for conversation ID usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted rounded-md">
              <strong>API Requests:</strong> Include conversation ID in headers or request body
            </div>
            <div className="p-3 bg-muted rounded-md">
              <strong>WebSocket Connections:</strong> Client ID automatically included in URL and metadata
            </div>
            <div className="p-3 bg-muted rounded-md">
              <strong>Logging/Analytics:</strong> Use conversation ID to track user sessions
            </div>
            <div className="p-3 bg-muted rounded-md">
              <strong>Local Storage:</strong> Client IDs persist across browser sessions
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Utility function example showing how to use conversation ID outside React components
 */
export function exampleUtilityFunction() {
  // This function can be called from anywhere (including non-React code)
  const convId = ConvIdManager.getConvId();

  console.log(`Processing request for client: ${convId}`);

  // Example: Including conversation ID in error reporting
  const errorInfo = {
    error: "Something went wrong",
    convId: convId,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
  };

  // Send error report with conversation ID
  // reportError(errorInfo);

  return errorInfo;
}