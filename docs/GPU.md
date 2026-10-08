# Integrated and discrete GPU monitoring

GPU identity, available sensor readings and rendering mode are different things.
An iGPU can be present even when the display is connected directly to a discrete
GPU. A missing sensor value is shown as N/A rather than as a made-up zero.

## Fix in 1.2.0

On the tested TUF A15, the AMD Radeon 680M was visible to Linux and had readable
GPU temperature and utilization files. The previous device-role heuristic tied
integration to the name `eDP-1`; its connector was `eDP-2`, so telemetry could
classify the AMD APU as discrete. The updated detector uses the AMD APU's
northbridge-voltage sensor and GPU vendor/model, with connector names only as a
fallback. AMD discrete Radeon RX models remain discrete even if an internal
panel is connected to them.

## See which GPUs Linux detects

```bash
lspci -nnk | grep -A3 -E 'VGA|3D|Display'
ls /sys/class/drm
```

Look for `Kernel driver in use: amdgpu` on an AMD GPU and `nvidia` on a proprietary
NVIDIA installation. Do not assume the integrated GPU is `card0` or `card1`;
card numbering changes between boots and driver configurations.

## AMD integrated or discrete GPUs

The open-source amdgpu kernel driver supplies hwmon temperature readings and,
on supported hardware, `gpu_busy_percent`. Mesa handles OpenGL/Vulkan rendering;
it is separate from these hardware-monitoring files. The application reads the
sensor files without modifying GPU power controls.

For the GPU directory shown on your machine, inspect:

```bash
cat /sys/class/drm/card2/device/vendor
cat /sys/class/drm/card2/device/power/runtime_status
cat /sys/class/drm/card2/device/gpu_busy_percent
cat /sys/class/drm/card2/device/hwmon/*/temp1_input
```

`card2` is an example from the tested laptop, not a universal path. Temperature
is in millidegrees Celsius: 46000 means 46°C. The `in1_input` northbridge-voltage
sensor is an APU signal; GPU SoC power on an APU may include the CPU, so it must
not be advertised as isolated graphics power.

If the PCI GPU is missing entirely, check the BIOS/MUX mode and whether the
kernel binds amdgpu. Updating a supported Ubuntu kernel/firmware can help missing
hardware support. If only one sensor is absent, that does not mean the GPU itself
is absent. Do not change modes or reboot during a GPU compute/recording job.

## NVIDIA laptops with an AMD iGPU

`nvidia-smi` reports NVIDIA GPUs; it will not show an AMD Radeon iGPU. This app
reads the AMD side from sysfs and the NVIDIA side from NVML when the NVIDIA device
is awake and the driver provides the metric. Sleeping discrete GPUs are not
woken solely to fill in the monitor.

```bash
nvidia-smi
```

If the NVIDIA driver is missing, use Ubuntu's Additional Drivers settings to
select a compatible distribution driver. This installer does not replace it.

In Advanced → GPU Configuration, ASUS Optimus/hybrid mode can allow the iGPU to
drive the display while NVIDIA renders selected applications. Ultimate/direct
mode routes the display to the discrete GPU. Mode availability and reboot
requirements depend on the laptop. Changing the display route is not required
to fix the detector bug above when both GPUs are already visible to Linux.

PRIME rendering can be checked separately with `glxinfo -B` (from `mesa-utils`).
For an NVIDIA-offloaded OpenGL application, NVIDIA documents
`__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia`. This selects
rendering; it does not install a driver or force all missing sensor data to exist.

Intel iGPU telemetry and AMD-only laptop layouts have not been validated by this
release. The verified hardware is an AMD Radeon 680M plus NVIDIA RTX 4060.

## References

- [Linux amdgpu monitoring interfaces](https://www.kernel.org/doc/html/latest/gpu/amdgpu/thermal.html)
- [NVIDIA PRIME Render Offload](https://download.nvidia.com/XFree86/Linux-x86_64/580.173.02/README/primerenderoffload.html)
- [ASUS MUX and graphics modes](https://rog.asus.com/us/articles/rog-gaming-laptops/maximize-your-rog-laptops-performance-with-a-mux-switch/)
