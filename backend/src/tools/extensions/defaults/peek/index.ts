/**
 * Peek Extension
 * Paginated access to large stored outputs
 */

import { retrieveOutput, getOutputMetadata } from "../../../script-runtime/output-storage";

export interface PeekResult {
  outputId: string;
  data: any;
  metadata: {
    totalSize: number;
    dataType: string;
    rowCount?: number;
    requestedOffset: number;
    requestedLimit: number;
    actualReturned: number;
    hasMore: boolean;
  };
}

/**
 * Peek extension
 */
export default {
  /**
   * Paginated access to stored output
   *
   * Usage:
   * const result = await peek('conv123-tool456-789', 100, 100);
   */
  peek: async (
    outputId: string,
    offset: number = 0,
    limit: number = 100
  ): Promise<PeekResult> => {
    if (offset < 0) {
      throw new Error("Offset must be non-negative");
    }
    if (limit <= 0) {
      throw new Error("Limit must be positive");
    }

    const metadata = getOutputMetadata(outputId);
    if (!metadata) {
      throw new Error(`Output not found: ${outputId}`);
    }

    const fullOutput = await retrieveOutput(outputId);

    let data: any;
    let actualReturned: number;
    let hasMore: boolean;

    if (Array.isArray(fullOutput)) {
      const end = Math.min(offset + limit, fullOutput.length);
      data = fullOutput.slice(offset, end);
      actualReturned = data.length;
      hasMore = end < fullOutput.length;
    } else if (typeof fullOutput === "string") {
      const end = Math.min(offset + limit, fullOutput.length);
      data = fullOutput.substring(offset, end);
      actualReturned = data.length;
      hasMore = end < fullOutput.length;
    } else if (typeof fullOutput === "object" && fullOutput !== null) {
      const keys = Object.keys(fullOutput);
      const end = Math.min(offset + limit, keys.length);
      const selectedKeys = keys.slice(offset, end);
      data = {};
      for (const key of selectedKeys) {
        data[key] = fullOutput[key];
      }
      actualReturned = selectedKeys.length;
      hasMore = end < keys.length;
    } else {
      data = fullOutput;
      actualReturned = 1;
      hasMore = false;
    }

    return {
      outputId,
      data,
      metadata: {
        totalSize: metadata.size,
        dataType: metadata.dataType,
        rowCount: metadata.rowCount,
        requestedOffset: offset,
        requestedLimit: limit,
        actualReturned,
        hasMore,
      },
    };
  },

  /**
   * Get output metadata without retrieving data
   */
  peekInfo: async (outputId: string) => {
    const metadata = getOutputMetadata(outputId);
    if (!metadata) {
      throw new Error(`Output not found: ${outputId}`);
    }

    return metadata;
  },
};
