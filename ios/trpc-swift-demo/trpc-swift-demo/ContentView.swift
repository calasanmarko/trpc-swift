//
//  ContentView.swift
//  trpc-swift-demo
//
//  Created by Marko on 11/16/23.
//

import SwiftUI

struct ContentView: View {
    let app = AppClient(baseUrl: URL(string: "http://localhost:5050/trpc")!)
    
    var body: some View {
        VStack {
            Button {
                doQuery()
            } label: {
                Text("Test")
            }
        }
        .padding()
        .onAppear {
            doQuery()
        }
    }
    
    func doQuery() {
        Task {
            let res = try! await app.layer.depth.four(input: .init(name: "Test"))!
            print(res)
        }
    }
}

#Preview {
    ContentView()
}
