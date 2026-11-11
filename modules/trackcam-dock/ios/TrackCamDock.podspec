Pod::Spec.new do |s|
  s.name           = 'TrackCamDock'
  s.version        = '1.0.0'
  s.summary        = 'DockKit spike'
  s.description    = 'Testa o que o estabilizador aceita via DockKit'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.frameworks     = 'AVFoundation'
  s.weak_frameworks = 'DockKit'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
