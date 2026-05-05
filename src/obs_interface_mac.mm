// macOS-specific preview implementation. ObjC++ to deal with NSView.
//
// noobs takes a parent NSView pointer from JS (BrowserWindow's
// contentView, fetched via Electron's getNativeWindowHandle on the
// main process). It creates a child NSView, parents it to the
// supplied view, and tells libobs to render the OBS canvas into the
// child via obs_display_create's gs_window.view field.
//
// The C++ entry points are compiled into noobs only on darwin (see
// binding.gyp). The corresponding Win32 implementations live in
// obs_interface.cpp under #ifdef _WIN32.

#import <Cocoa/Cocoa.h>
#include <obs.h>
#include "obs_interface.h"
#include "utils.h"

// Defined in obs_interface.cpp. Extern decl avoids dragging the
// callback's body into the ObjC++ TU.
extern void draw_callback(void* data, uint32_t cx, uint32_t cy);

namespace {
// One NSView per ObsInterface (we keep a single preview display today
// but the code could lift the limit later). Stored as void* so the
// header doesn't need to drag in Cocoa types.
NSView *to_view(uintptr_t handle) {
  return (__bridge NSView *)reinterpret_cast<void *>(handle);
}
}

void ObsInterface::initPreview(uintptr_t parentHandle) {
  blog(LOG_INFO, "ObsInterface::initPreview (mac) parent=%p",
       reinterpret_cast<void *>(parentHandle));

  NSView *parent = to_view(parentHandle);
  if (!parent) {
    blog(LOG_ERROR, "initPreview: null parent handle");
    return;
  }

  // Block the main thread side-effects until the child view is wired
  // up; libobs's display creation expects the view to exist before
  // obs_display_create returns. NSView APIs must run on the main
  // thread.
  __block NSView *child = nil;
  dispatch_block_t setup = ^{
    child = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 1, 1)];
    [child setWantsLayer:YES];
    [child setHidden:YES];
    [parent addSubview:child];
  };
  if ([NSThread isMainThread]) {
    setup();
  } else {
    dispatch_sync(dispatch_get_main_queue(), setup);
  }

  preview_handle = reinterpret_cast<uintptr_t>((__bridge void *)child);

  if (!display) {
    gs_init_data gs_data = {};
    gs_data.cx = 1920; // overwritten by configurePreview
    gs_data.cy = 1080;
    gs_data.format = GS_BGRA;
    gs_data.zsformat = GS_ZS_NONE;
    gs_data.num_backbuffers = 1;
    gs_data.window.view = (__bridge id)(__bridge void *)child;

    display = obs_display_create(&gs_data, 0x0);
    if (!display) {
      blog(LOG_ERROR, "Failed to create OBS display on mac");
      return;
    }
    obs_display_add_draw_callback(display, draw_callback, this);
  }

  obs_display_set_enabled(display, false);
}

void ObsInterface::configurePreview(int x, int y, int width, int height) {
  blog(LOG_INFO,
       "ObsInterface::configurePreview (mac) x=%d y=%d w=%d h=%d",
       x, y, width, height);

  NSView *child = to_view(preview_handle);
  if (!child) {
    blog(LOG_ERROR, "configurePreview: preview view not initialized");
    return;
  }
  if (!display) {
    blog(LOG_ERROR, "configurePreview: display not initialized");
    return;
  }

  dispatch_block_t apply = ^{
    NSView *parent = [child superview];
    if (!parent) return;
    // Cocoa origin is bottom-left. Caller passes top-left like the
    // Win32 path; flip Y so layout matches the renderer's
    // configurePreview math.
    CGFloat parentH = [parent bounds].size.height;
    CGFloat flippedY = parentH - y - height;
    [child setFrame:NSMakeRect(x, flippedY, width, height)];
  };
  if ([NSThread isMainThread]) {
    apply();
  } else {
    dispatch_sync(dispatch_get_main_queue(), apply);
  }

  obs_display_resize(display, width, height);
  obs_display_set_enabled(display, true);
}

void ObsInterface::showPreview() {
  blog(LOG_INFO, "ObsInterface::showPreview (mac)");

  NSView *child = to_view(preview_handle);
  if (!child) {
    blog(LOG_ERROR, "showPreview: preview view not initialized");
    return;
  }
  if (!display) {
    blog(LOG_ERROR, "showPreview: display not initialized");
    return;
  }

  dispatch_block_t apply = ^{ [child setHidden:NO]; };
  if ([NSThread isMainThread]) {
    apply();
  } else {
    dispatch_sync(dispatch_get_main_queue(), apply);
  }
  obs_display_set_enabled(display, true);
}

void ObsInterface::hidePreview() {
  blog(LOG_INFO, "ObsInterface::hidePreview (mac)");

  NSView *child = to_view(preview_handle);
  if (!child) return;

  dispatch_block_t apply = ^{ [child setHidden:YES]; };
  if ([NSThread isMainThread]) {
    apply();
  } else {
    dispatch_sync(dispatch_get_main_queue(), apply);
  }
}
