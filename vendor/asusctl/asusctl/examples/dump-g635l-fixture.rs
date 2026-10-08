//! Prints the expected packet bytes for `rog-anime/tests/g635l.rs` so the
//! fixture can be re-derived after protocol changes.
//!
//! Loads the existing `rog-anime/tests/data/g835l-diagonal.gif` test
//! fixture as `AnimeType::G635L`, runs it through the new G635L USB
//! packet pipeline, and prints both 640-byte packets as hex literal
//! arrays suitable for paste into Rust source.
//!
//! Run with:
//!     cargo run --example dump-g635l-fixture
//!
//! Output goes to stdout. The G635L test file uses byte-level assertions
//! against AnimeDataBuffer.data() rather than hardcoded fixture arrays,
//! so this example is mainly useful when adding more elaborate
//! pattern-specific tests in the future.

use std::path::PathBuf;

use rog_anime::{AnimTime, AnimeGif, AnimePacketType, AnimeType};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Walk up from asusctl/ to the workspace root, then into rog-anime.
    path.push("../rog-anime/tests/data/g835l-diagonal.gif");
    let path = path.canonicalize()?;

    println!("Loading: {}", path.display());

    let gif = AnimeGif::from_diagonal_gif(&path, AnimTime::Count(1), 1.0, AnimeType::G635L)?;
    println!("Frames: {}", gif.frame_count());

    let frame = gif.frames()[0].frame().clone();
    println!("LED data length: {} bytes", frame.data().len());

    let pkts = AnimePacketType::try_from(frame)?;
    println!("Packet count: {}", pkts.len());

    for (i, pkt) in pkts.iter().enumerate() {
        println!();
        println!("// Packet {} ({} bytes):", i, pkt.len());
        println!("let pkt{}_check = [", i);
        for chunk in pkt.chunks(14) {
            print!("    ");
            for b in chunk {
                print!("{:#04x}, ", b);
            }
            println!();
        }
        println!("];");
    }

    Ok(())
}
