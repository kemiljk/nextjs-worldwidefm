"use client";

import { useState, useEffect } from "react";
import { COSMIC_CONFIG } from "@/lib/cosmic-config";
import { Button } from "@/components/ui/button";

export function CosmicDebugger() {
  const [showDetails, setShowDetails] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if credentials exist (without showing the actual values)
  const hasBucketSlug = !!COSMIC_CONFIG.bucketSlug;
  const hasReadKey = !!COSMIC_CONFIG.readKey;

  // Test the connection to Cosmic
  const testConnection = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // Build basic query to test connectivity
      const params = new URLSearchParams({
        read_key: COSMIC_CONFIG.readKey,
      });

      const url = `${COSMIC_CONFIG.apiUrl}/buckets/${COSMIC_CONFIG.bucketSlug}/objects?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        setTestResult({
          success: false,
          message: `Error ${response.status}: ${errorText}`,
        });
      } else {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Success! Found ${data.total || 0} objects.`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
      <h2 className="text-lg font-medium text-red-800 mb-2">Cosmic API Debugger</h2>

      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${hasBucketSlug ? "bg-green-500" : "bg-red-500"}`}></div>
          <p>Bucket Slug: {hasBucketSlug ? "Present" : "Missing"}</p>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${hasReadKey ? "bg-green-500" : "bg-red-500"}`}></div>
          <p>Read Key: {hasReadKey ? "Present" : "Missing"}</p>
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={testConnection} variant="outline" size="sm" className="mr-2 text-sm" disabled={isLoading}>
          {isLoading ? "Testing..." : "Test Connection"}
        </Button>

        <Button onClick={() => setShowDetails(!showDetails)} variant="ghost" size="sm" className="text-sm">
          {showDetails ? "Hide Details" : "Show Details"}
        </Button>
      </div>

      {testResult && <div className={`mt-3 p-2 text-sm rounded ${testResult.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{testResult.message}</div>}

      {showDetails && (
        <div className="mt-4 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-32">
          <p>API URL: {COSMIC_CONFIG.apiUrl}</p>
          <p>Bucket Slug: {COSMIC_CONFIG.bucketSlug || "Not set"}</p>
          <p>Read Key: {COSMIC_CONFIG.readKey ? "[HIDDEN]" : "Not set"}</p>
          <p className="mt-2 text-gray-600">Check your .env.local file to ensure these values are set correctly.</p>
        </div>
      )}
    </div>
  );
}
