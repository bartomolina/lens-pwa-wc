import { image, MediaImageMimeType, textOnly } from "@lens-protocol/metadata";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { ARWEAVE_GATEWAY } from "@/lib/constants";
import { lensClient } from "@/lib/lens-client";
import { upload } from "@/utils/irys";

interface CreatePublicationOptions {
  onSuccess?: () => void;
}

export const useCreatePublication = ({
  onSuccess,
}: CreatePublicationOptions) => {
  const { address } = useAccount();

  return useMutation({
    mutationFn: async ({ content, file }: { content: string; file?: File }) => {
      if (!file && content.length === 0) {
        return;
      }

      if (address) {
        let metadata;
        if (file) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/uploadFile", {
            method: "POST",
            body: formData,
          });

          const resData = await res.json();

          metadata = image({
            image: {
              item: `ipfs://${resData.IpfsHash}`,
              type: file.type as MediaImageMimeType,
            },
            content,
          });
        } else {
          metadata = textOnly({
            content,
          });
        }

        const metadataFile = await upload(address, JSON.stringify(metadata));

        if (!metadataFile.id) return;

        const contentURI = `${ARWEAVE_GATEWAY}${metadataFile.id}`;
        const postResult = await lensClient.publication.postOnMomoka({
          contentURI,
        });

        if ("reason" in postResult && typeof postResult.reason === "string") {
          throw new Error(postResult.reason);
        }

        if ("txId" in postResult && typeof postResult.txId === "string") {
          await lensClient.transaction.waitUntilComplete({
            forTxId: postResult.txId,
          });
        }

        console.log("use create publication:", postResult);
      }
    },
    onSuccess,
  });
};
