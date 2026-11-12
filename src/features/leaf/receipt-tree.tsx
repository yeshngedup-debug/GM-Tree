"use client";
import { useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import type { TreeCanvasProps } from "@/features/display/tree-canvas";
const TreeCanvas = dynamic<TreeCanvasProps>(
  () => import("@/features/display/tree-canvas").then((mod) => mod.TreeCanvas),
  { ssr: false },
);
import type { SceneController } from "@/features/display/tree-scene";
import { useTree } from "@/hooks/use-tree";
import { themeFor, type Leaf } from "@/lib/catalog";
import { treePalettes } from "@/lib/tree-settings";
export function ReceiptTree({ leaf }: { leaf: Leaf }) {
  const { tree } = useTree();
  const scene = useRef<SceneController | null>(null),
    container = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const leaves = tree
    ? [leaf, ...tree.leaves.filter((item) => item.id !== leaf.id)].slice(0, 120)
    : [leaf];
  async function save() {
    setBusy(true);
    setNotice("");
    try {
      let blob: Blob, suffix: string;
      if (scene.current) {
        const image = await createImageBitmap(await scene.current.capture(3));
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 1100;
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("Image export is unavailable on this browser.");
        const dark = tree?.settings.palette === "night";
        const palette = treePalettes[tree?.settings.palette || "spring"];
        context.fillStyle = palette.background;
        context.fillRect(0, 0, 1000, 1100);
        const ratio = Math.min(1000 / image.width, 760 / image.height);
        context.drawImage(
          image,
          (1000 - image.width * ratio) / 2,
          760 - image.height * ratio,
          image.width * ratio,
          image.height * ratio,
        );
        image.close();
        context.textAlign = "center";
        context.fillStyle = dark ? "#f1f4e8" : "#243c3a";
        context.font = "28px Georgia";
        context.fillText("GM Tree", 500, 66);
        context.font = "19px Arial";
        context.fillText(
          `Your leaf #${leaf.id.slice(0, 6)} · ${Math.max(tree?.total || 0, leaves.length)} shared hopes`,
          500,
          104,
        );
        context.save();
        context.translate(500, 830);
        context.fillStyle = themeFor(leaf.category).color;
        context.beginPath();
        context.moveTo(0, 20);
        context.bezierCurveTo(-42, -8, -32, -46, 0, -50);
        context.bezierCurveTo(35, -26, 38, 5, 0, 20);
        context.fill();
        context.strokeStyle = dark ? "#f1f4e8" : "#243c3a";
        context.beginPath();
        context.moveTo(0, 16);
        context.lineTo(0, -35);
        context.stroke();
        context.restore();
        context.font = "28px Georgia";
        const lines: string[] = [];
        let line = "";
        for (const word of leaf.leaf_message.split(/\s+/)) {
          if (context.measureText(`${line} ${word}`).width > 820 && line) {
            lines.push(line);
            line = word;
          } else line += `${line ? " " : ""}${word}`;
        }
        if (line) lines.push(line);
        lines
          .slice(0, 4)
          .forEach((text, index) =>
            context.fillText(text, 500, 912 + index * 38, 820),
          );
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Could not save the tree image.")),
            "image/png",
          ),
        );
        suffix = "png";
      } else {
        const illustration = container.current?.querySelector("svg.tree-svg");
        if (!illustration)
          throw new Error("The tree is still loading. Try saving in a moment.");
        const svg = illustration.cloneNode(true) as SVGSVGElement;
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", "1000");
        svg.setAttribute("height", "1100");
        // Make the selected leaf visible even without the website stylesheet.
        svg
          .querySelector(".active-leaf > path")
          ?.setAttribute("stroke", "#ffffff");
        svg
          .querySelector(".active-leaf > path")
          ?.setAttribute("stroke-width", "2");
        blob = new Blob([new XMLSerializer().serializeToString(svg)], {
          type: "image/svg+xml",
        });
        suffix = "svg";
      }
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gmc-tree-with-leaf-${leaf.id.slice(0, 8)}.${suffix}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Your tree image has been saved.");
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "The image could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Your leaf on the living tree"
      className="receipt-tree-card"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="text-lg">A little more life, because of you.</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The tree’s current growth · your leaf #{leaf.id.slice(0, 6)} is
            highlighted.
          </p>
        </div>
      </div>
      <div ref={container} className="receipt-tree-stage">
        <TreeCanvas
          leaves={leaves}
          contributionCount={Math.max(tree?.stats.total || 0, leaves.length)}
          settings={tree?.settings}
          activeId={leaf.id}
          onSelect={() => {}}
          sceneRef={scene}
          showControls={false}
          environment="garden"
          className="receipt-tree-canvas"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4">
        <p className="text-[11px] text-muted-foreground">
          {tree
            ? `${tree.stats.total} shared ${tree.stats.total === 1 ? "hope" : "hopes"}`
            : "Opening the living tree…"}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? (
            <LoaderCircle size={13} className="orbit" />
          ) : (
            <Download size={13} />
          )}
          Save tree image
        </Button>
      </div>
      {notice && (
        <p role="status" className="px-4 pb-4 text-xs">
          {notice}
        </p>
      )}
    </section>
  );
}
